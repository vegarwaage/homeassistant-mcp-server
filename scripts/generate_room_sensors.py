#!/usr/bin/env python3
"""
Generate Home Assistant template sensors for room-based air quality tracking.

This script creates 207 template sensors (9 metrics × 23 rooms) that dynamically
pull data from whichever physical sensor is currently assigned to each room.
"""

from typing import Dict, List, Optional

# Room list (23 rooms)
ROOMS = [
    "Hybel",
    "Under hagestuen",
    "Under soverommene",
    "Under soveromsgangen",
    "Bod 1",
    "Bod 2",
    "Kjellerrom",
    "Hagestue",
    "Hovedbad",
    "Soverom 1",
    "Soverom 2",
    "Soverom 3",
    "Toalett 1",
    "Toalett 2",
    "Barneentre",
    "Entre",
    "Fryserommet",
    "Garasje",
    "Garasjebod",
    "Grovkjøkken",
    "Kjøkken",
    "Gjesterom",
    "Stue"
]

# Metric definitions with their properties
METRICS = {
    "temperature": {
        "name": "Temperature",
        "device_class": "temperature",
        "state_class": "measurement",
        "unit": "°C",
    },
    "humidity": {
        "name": "Humidity",
        "device_class": "humidity",
        "state_class": "measurement",
        "unit": "%",
    },
    "pm2_5": {
        "name": "PM2.5",
        "device_class": "pm25",
        "state_class": "measurement",
        "unit": "µg/m³",
    },
    "voc": {
        "name": "VOC",
        "device_class": "aqi",
        "state_class": "measurement",
        "unit": None,
    },
    "co2": {
        "name": "CO2",
        "device_class": "carbon_dioxide",
        "state_class": "measurement",
        "unit": "ppm",
    },
    "radon": {
        "name": "Radon",
        "device_class": None,
        "state_class": "measurement",
        "unit": "Bq/m³",
    },
    "pm1": {
        "name": "PM1",
        "device_class": "pm1",
        "state_class": "measurement",
        "unit": "µg/m³",
    },
    "pressure": {
        "name": "Atmospheric Pressure",
        "device_class": "atmospheric_pressure",
        "state_class": "measurement",
        "unit": "hPa",
    },
    "brightness": {
        "name": "Brightness",
        "device_class": "illuminance",
        "state_class": "measurement",
        "unit": "lx",
    },
}

# Physical sensor mappings
# Format: "sensor_key": {"input_select": "...", "metrics": {"metric_key": "entity_id"}}
PHYSICAL_SENSORS = {
    "v1": {
        "input_select": "input_select.air_probe_v1_room",
        "name": "Vindstyrka 1",
        "metrics": {
            "temperature": "sensor.ikea_vindstyrka_1_temperature",
            "humidity": "sensor.ikea_vindstyrka_1_humidity",
            "pm2_5": "sensor.ikea_vindstyrka_1_pm2_5",
            "voc": "sensor.ikea_vindstyrka_1_voc_index",
        }
    },
    "v2": {
        "input_select": "input_select.air_probe_v2_room",
        "name": "Vindstyrka 2",
        "metrics": {
            "temperature": "sensor.ikea_vindstyrka_2_temperature",
            "humidity": "sensor.ikea_vindstyrka_2_humidity",
            "pm2_5": "sensor.ikea_vindstyrka_2_pm2_5",
            "voc": "sensor.ikea_vindstyrka_2_voc_index",
        }
    },
    "v3": {
        "input_select": "input_select.air_probe_v3_room",
        "name": "Vindstyrka 3",
        "metrics": {
            "temperature": "sensor.ikea_vindstyrka_3_temperature",
            "humidity": "sensor.ikea_vindstyrka_3_humidity",
            "pm2_5": "sensor.ikea_vindstyrka_3_pm2_5",
            "voc": "sensor.ikea_vindstyrka_3_voc_index",
        }
    },
    "sl1": {
        "input_select": "input_select.air_probe_sl1_room",
        "name": "SmartLife 1",
        "metrics": {
            "temperature": "sensor.bright_smart_humidity_temperature_sen_temperature",
            "humidity": "sensor.bright_smart_humidity_temperature_sen_humidity",
            "brightness": "sensor.bright_smart_humidity_temperature_sen_illuminance",
        }
    },
    "at1": {
        "input_select": "input_select.air_probe_at1_room",
        "name": "Airthings View Plus",
        "metrics": {
            "temperature": "sensor.view_plus_temperature",
            "humidity": "sensor.view_plus_humidity",
            "pm2_5": "sensor.view_plus_pm2_5",
            "pm1": "sensor.view_plus_pm1",
            "co2": "sensor.view_plus_carbon_dioxide",
            "radon": "sensor.view_plus_radon",
            "voc": "sensor.view_plus_volatile_organic_compounds_parts",
            "pressure": "sensor.view_plus_atmospheric_pressure",
        }
    },
}


def normalize_room_name(room: str) -> str:
    """Convert room name to valid entity ID format."""
    return room.lower().replace(" ", "_").replace("ø", "o").replace("å", "a")


def generate_template_sensor(room: str, metric_key: str, metric_def: Dict) -> Optional[str]:
    """Generate a single template sensor configuration as YAML text."""
    room_normalized = normalize_room_name(room)
    unique_id = f"{metric_key}_{room_normalized}"

    # Build state template - check each physical sensor
    state_conditions = []
    availability_conditions = []

    for sensor_key, sensor_config in PHYSICAL_SENSORS.items():
        if metric_key in sensor_config["metrics"]:
            input_select = sensor_config["input_select"]
            sensor_entity = sensor_config["metrics"][metric_key]

            state_conditions.append({
                "input_select": input_select,
                "room": room,
                "sensor_entity": sensor_entity
            })

            availability_conditions.append(
                f"states('{input_select}') == '{room}'"
            )

    # If no sensors provide this metric, return None
    if not state_conditions:
        return None

    # Build final template
    state_parts = []
    for i, condition in enumerate(state_conditions):
        if i == 0:
            state_parts.append(
                f"          {{% if states('{condition['input_select']}') == '{condition['room']}' %}}\n"
                f"            {{{{ states('{condition['sensor_entity']}') }}}}"
            )
        else:
            state_parts.append(
                f"          {{% elif states('{condition['input_select']}') == '{condition['room']}' %}}\n"
                f"            {{{{ states('{condition['sensor_entity']}') }}}}"
            )

    state_template = ">\n" + "\n".join(state_parts) + "\n          {% else %}\n            none\n          {% endif %}"

    availability_template = f">\n          {{{{ {' or '.join(availability_conditions)} }}}}"

    # Build sensor YAML
    yaml_lines = [
        f"      - name: \"{metric_def['name']} - {room}\"",
        f"        unique_id: {unique_id}",
    ]

    # Add device_class if defined
    if metric_def.get("device_class"):
        yaml_lines.append(f"        device_class: {metric_def['device_class']}")

    # Add state_class if defined
    if metric_def.get("state_class"):
        yaml_lines.append(f"        state_class: {metric_def['state_class']}")

    # Add unit_of_measurement if defined
    if metric_def.get("unit"):
        yaml_lines.append(f"        unit_of_measurement: \"{metric_def['unit']}\"")

    # Add state template
    yaml_lines.append(f"        state: {state_template}")

    # Add availability template
    yaml_lines.append(f"        availability: {availability_template}")

    # Add custom attribute
    yaml_lines.append("        attributes:")
    yaml_lines.append("          room_sensor: true")

    return "\n".join(yaml_lines)


def generate_configuration() -> str:
    """Generate complete Home Assistant configuration as YAML text."""
    sensors = []

    # Generate all combinations of rooms × metrics
    for room in ROOMS:
        for metric_key, metric_def in METRICS.items():
            sensor = generate_template_sensor(room, metric_key, metric_def)
            if sensor:
                sensors.append(sensor)

    # Build complete YAML
    yaml_output = "template:\n  - sensor:\n"
    yaml_output += "\n\n".join(sensors)

    return yaml_output


def write_yaml_file(yaml_content: str, output_path: str):
    """Write configuration to YAML file with proper formatting."""

    # Add header comment
    header = """# Room-based Air Quality Sensor Templates
# Auto-generated by scripts/generate_room_sensors.py
# DO NOT EDIT MANUALLY - regenerate using the script
#
# This file creates 207 template sensors (9 metrics × 23 rooms) that dynamically
# pull data from whichever physical sensor is currently assigned to each room.
#
# Physical sensors tracked:
#   - IKEA Vindstyrka 1, 2, 3 (Temperature, Humidity, PM2.5, VOC)
#   - SmartLife 1 (Temperature, Humidity, Brightness)
#   - Airthings View Plus (Temperature, Humidity, PM2.5, PM1, CO2, Radon, VOC, Pressure)
#
# Room assignments controlled by:
#   - input_select.air_probe_v1_room (Vindstyrka 1)
#   - input_select.air_probe_v2_room (Vindstyrka 2)
#   - input_select.air_probe_v3_room (Vindstyrka 3)
#   - input_select.air_probe_sl1_room (SmartLife 1)
#   - input_select.air_probe_at1_room (Airthings View Plus)

"""

    with open(output_path, 'w') as f:
        f.write(header)
        f.write(yaml_content)

    # Count sensors
    sensor_count = yaml_content.count("- name:")

    print(f"✓ Generated configuration: {output_path}")
    print(f"✓ Total sensors created: {sensor_count}")


def main():
    """Main entry point."""
    import sys

    # Allow output path to be specified as command line argument
    output_path = sys.argv[1] if len(sys.argv) > 1 else "/config/packages/room_sensors.yaml"

    print("Generating room sensor configuration...")
    print(f"  Rooms: {len(ROOMS)}")
    print(f"  Metrics: {len(METRICS)}")
    print(f"  Physical sensors: {len(PHYSICAL_SENSORS)}")
    print()

    yaml_content = generate_configuration()
    write_yaml_file(yaml_content, output_path)

    print()
    print("Next steps:")
    print("  1. Review the generated file")
    print("  2. Validate HA config: ha core check")
    print("  3. Reload templates: Developer Tools > YAML > Template Entities")
    print("  4. Test sensor assignments")


if __name__ == "__main__":
    main()
