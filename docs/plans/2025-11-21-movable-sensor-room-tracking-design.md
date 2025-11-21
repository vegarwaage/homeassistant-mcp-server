# Movable Air Quality Sensor Room Tracking System

**Date:** 2025-11-21
**Author:** Claude (with Vegar)
**Status:** Design Complete - Ready for Implementation

## Problem Statement

Vegar has 5 physical air quality sensors that he moves between 23 rooms in his house. He wants to track historical air quality data on a per-room basis, not per-physical-sensor basis. Currently, when a sensor moves from Room A to Room B, all historical data is associated with the physical sensor, not the rooms.

**Current state:**
- 5 physical sensors with different capabilities
- 5 input_selects to manually track which room each sensor is in
- 115+ orphaned template sensors (Norwegian names) that are unavailable
- No automatic room-based data tracking

**Desired state:**
- Change input_select when moving a sensor
- Room sensors automatically show current data from whichever sensor is there
- Historical data accumulates per room, regardless of which sensor was there when

## Physical Sensors Inventory

### Active Sensors (5)

1. **IKEA Vindstyrka 1** (`sensor.ikea_vindstyrka_1_*`)
   - Temperature, PM2.5, Humidity, VOC index
   - Currently in: Soverom 1

2. **IKEA Vindstyrka 2** (`sensor.ikea_vindstyrka_2_*`)
   - Temperature, PM2.5, Humidity, VOC index
   - Currently in: Soverom 2

3. **IKEA Vindstyrka 3** (`sensor.ikea_vindstyrka_3_*`)
   - Temperature, PM2.5, Humidity, VOC index
   - Currently in: Soverom 3

4. **SmartLife 1 (Tuya)** (`sensor.tuya_*`)
   - Temperature, Humidity, Brightness, Battery
   - Currently in: Under soverommene

5. **Airthings View Plus** (`sensor.view_plus_*`)
   - Temperature, Humidity, PM2.5, PM1, CO2, Radon, VOC, Atmospheric Pressure
   - Currently in: Soverom 1

### Room List (23 rooms)

Hybel, Under hagestuen, Under soverommene, Under soveromsgangen, Bod 1, Bod 2, Kjellerrom, Hagestue, Hovedbad, Soverom 1, Soverom 2, Soverom 3, Toalett 1, Toalett 2, Barneentre, Entre, Fryserommet, Garasje, Garasjebod, Grovkjøkken, Kjøkken, Gjesterom, Stue

## Architecture

### Core Components

1. **Input Selects (existing)**: Track room assignments
   - `input_select.air_probe_v1_room` → Vindstyrka 1
   - `input_select.air_probe_v2_room` → Vindstyrka 2
   - `input_select.air_probe_v3_room` → Vindstyrka 3
   - `input_select.air_probe_sl1_room` → SmartLife 1
   - `input_select.air_probe_at1_room` → Airthings View Plus

2. **Template Sensors (new)**: 207 room-based sensors
   - Pattern: `sensor.{metric}_{room_normalized}`
   - Example: `sensor.temperature_hybel`, `sensor.pm2_5_soverom_1`, `sensor.radon_kjokken`
   - Language: English (migrating from Norwegian)

3. **Metrics Tracked**: 9 metrics × 23 rooms = 207 sensors
   - Temperature (all sensors)
   - Humidity (all sensors)
   - PM2.5 (Vindstyrka 1-3, Airthings)
   - VOC (Vindstyrka 1-3, Airthings)
   - CO2 (Airthings only)
   - Radon (Airthings only)
   - PM1 (Airthings only)
   - Atmospheric Pressure (Airthings only)
   - Brightness/Lux (SmartLife only)

### Data Flow Logic

Each template sensor follows this evaluation pattern:

```
For sensor.temperature_hybel:
1. Check input_select.air_probe_v1_room → is it "Hybel"?
   → YES: Return sensor.ikea_vindstyrka_1_temperature
2. Check input_select.air_probe_v2_room → is it "Hybel"?
   → YES: Return sensor.ikea_vindstyrka_2_temperature
3. Check input_select.air_probe_v3_room → is it "Hybel"?
   → YES: Return sensor.ikea_vindstyrka_3_temperature
4. Check input_select.air_probe_sl1_room → is it "Hybel"?
   → YES: Return sensor.[smartlife_temperature]
5. Check input_select.air_probe_at1_room → is it "Hybel"?
   → YES: Return sensor.view_plus_temperature
6. No sensor assigned to Hybel
   → Return: "none" (with availability = false)
```

### Metric Availability Matrix

| Metric | Vindstyrka 1-3 | SmartLife 1 | Airthings |
|--------|---------------|-------------|-----------|
| Temperature | ✓ | ✓ | ✓ |
| Humidity | ✓ | ✓ | ✓ |
| PM2.5 | ✓ | ✗ | ✓ |
| VOC | ✓ | ✗ | ✓ |
| CO2 | ✗ | ✗ | ✓ |
| Radon | ✗ | ✗ | ✓ |
| PM1 | ✗ | ✗ | ✓ |
| Pressure | ✗ | ✗ | ✓ |
| Brightness | ✗ | ✓ | ✗ |

**Template behavior for missing metrics:**
- If Vindstyrka is in "Kjokken" and you check `sensor.radon_kjokken`: unavailable
- If Airthings moves to "Kjokken": `sensor.radon_kjokken` immediately starts showing data

### Unavailable State Handling

**Problem:** Room sensors will frequently be unavailable (no sensor assigned, or sensor doesn't have that metric). We don't want these to trigger unavailable notifications.

**Solution:** Add custom attribute to all template sensors:
```yaml
attributes:
  room_sensor: true
```

**Notification automation filter:**
```yaml
condition:
  - condition: template
    value_template: >
      {{ state_attr(trigger.to_state.entity_id, 'room_sensor') != true }}
```

**Result:**
- ✅ Physical sensor offline → Notification sent
- ✅ Other humidity/temperature sensors offline → Notification sent
- ❌ Room template sensor unavailable → No notification (expected)

## Implementation Plan

### File Structure

**Location:** `/config/packages/room_sensors.yaml`
**Size:** ~2,500 lines (programmatically generated)

**Configuration pattern:**
```yaml
template:
  - sensor:
      - name: "Temperature - Hybel"
        unique_id: temperature_hybel
        device_class: temperature
        state_class: measurement
        unit_of_measurement: "°C"
        state: >
          {% if states('input_select.air_probe_v1_room') == 'Hybel' %}
            {{ states('sensor.ikea_vindstyrka_1_temperature') }}
          {% elif states('input_select.air_probe_v2_room') == 'Hybel' %}
            {{ states('sensor.ikea_vindstyrka_2_temperature') }}
          {% elif states('input_select.air_probe_v3_room') == 'Hybel' %}
            {{ states('sensor.ikea_vindstyrka_3_temperature') }}
          {% elif states('input_select.air_probe_sl1_room') == 'Hybel' %}
            {{ states('sensor.[smartlife_temperature]') }}
          {% elif states('input_select.air_probe_at1_room') == 'Hybel' %}
            {{ states('sensor.view_plus_temperature') }}
          {% else %}
            none
          {% endif %}
        availability: >
          {% set v1 = states('input_select.air_probe_v1_room') == 'Hybel' %}
          {% set v2 = states('input_select.air_probe_v2_room') == 'Hybel' %}
          {% set v3 = states('input_select.air_probe_v3_room') == 'Hybel' %}
          {% set sl1 = states('input_select.air_probe_sl1_room') == 'Hybel' %}
          {% set at1 = states('input_select.air_probe_at1_room') == 'Hybel' %}
          {{ v1 or v2 or v3 or sl1 or at1 }}
        attributes:
          room_sensor: true

      # Repeat for all 207 sensor combinations...
```

### Migration Strategy

**Goal:** Preserve historical data from existing sensors

1. **Entity ID mapping:**
   - Existing: `sensor.pm2_5_hybel` (Norwegian, unavailable)
   - New: `sensor.pm2_5_hybel` (English, template-based)
   - Use `unique_id` to link to existing entity registry entry

2. **Name translation:**
   - `sensor.luftfuktighet_hybel` → `sensor.humidity_hybel`
   - `sensor.temperatur_hybel` → `sensor.temperature_hybel`
   - Update friendly names to English

3. **Historical data:**
   - Home Assistant recorder sees it as same entity (via unique_id)
   - Historical data preserved
   - New data appends to same history

### Generation Script

Create Python script to generate the YAML:
- Input: Room list, sensor mappings, metric definitions
- Output: `/config/packages/room_sensors.yaml`
- Validate: All 207 sensors created, unique_ids correct

### Notification Automation Update

Update existing unavailable sensor automation to add exclusion condition (see "Unavailable State Handling" section above).

## Testing Plan

### Phase 1: Pre-deployment Validation
1. Generate configuration file with Python script
2. Validate YAML syntax (`yamllint`)
3. Check all 207 sensors defined correctly
4. Verify unique_ids match existing entity registry entries

### Phase 2: Deployment
1. Back up `/config/packages/` directory
2. Deploy `/config/packages/room_sensors.yaml`
3. Validate HA configuration (`ha core check`)
4. Reload template entities (no full restart needed)

### Phase 3: Functional Testing

**Test 1: Current assignments**
- Verify `sensor.temperature_soverom_1` shows Vindstyrka 1 data
- Verify `sensor.temperature_soverom_2` shows Vindstyrka 2 data
- Verify `sensor.radon_soverom_1` shows Airthings data

**Test 2: Sensor movement**
- Change `input_select.air_probe_v1_room` from "Soverom 1" to "Kjøkken"
- Verify `sensor.temperature_kjokken` immediately shows Vindstyrka 1 data
- Verify `sensor.temperature_soverom_1` updates appropriately

**Test 3: Unavailable behavior**
- Check room with no sensor assigned (e.g., "Hybel")
- Verify sensors show state "none" with availability = false
- Verify `room_sensor: true` attribute present

**Test 4: Notification exclusion**
- Trigger unavailable on room template sensor → No notification
- Disconnect physical sensor → Notification sent

### Phase 4: Historical Data Verification
1. Check existing room sensors retained history
2. Verify new data is being recorded
3. Confirm graphs show continuous data across sensor changes

## Resource Considerations

**Template count:** 207 sensors
**Evaluation frequency:** Only when dependencies change:
- Input_select changes (rare - when moving sensor)
- Physical sensor value updates (every 1-5 minutes)

**Performance impact:**
- Minimal on Raspberry Pi 4+ hardware
- Each evaluation: 5 string comparisons + 1 value lookup
- Well within Home Assistant's capabilities for template sensors

**Optimization note:** If performance issues arise, can reduce to "core metrics" (Temperature, Humidity, PM2.5, VOC only = 92 sensors), but current design prioritizes data completeness.

## Benefits

1. **Room-based historical data**: Track air quality trends per room, not per device
2. **Flexible sensor movement**: Move sensors freely, data follows the room context
3. **Comprehensive metrics**: Preserve all sensor capabilities (Radon, CO2, etc.)
4. **No manual data reconstruction**: Historical data accumulates automatically
5. **Clean notification system**: Room sensors don't trigger false unavailable alerts
6. **Migration path**: Preserves existing sensor history

## Future Enhancements (Optional)

- Dashboard cards showing which sensor is currently in each room
- Automation to suggest sensor rebalancing based on historical patterns
- Alerts when high-value metrics (Radon, CO2) haven't been measured in a room for X days
- Export room-based reports for health monitoring

## Rollback Plan

If issues arise:
1. Remove `/config/packages/room_sensors.yaml`
2. Reload template entities
3. System returns to previous state
4. Historical data remains intact (no destructive operations)
