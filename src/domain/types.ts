// ABOUTME: Domain layer type definitions for HA entity management
// ABOUTME: Types for scenes, scripts, helpers, areas, zones, devices

export interface Scene {
  entity_id: string;
  name: string;
  icon?: string;
  entities: Record<string, any>;
}

export interface Script {
  entity_id: string;
  name: string;
  icon?: string;
  mode: 'single' | 'restart' | 'queued' | 'parallel';
  sequence: ScriptStep[];
  fields?: Record<string, ScriptField>;
}

export interface ScriptStep {
  [key: string]: any;
}

export interface ScriptField {
  description?: string;
  example?: any;
  default?: any;
  required?: boolean;
  advanced?: boolean;
  selector?: any;
}

export interface InputHelper {
  entity_id: string;
  name: string;
  icon?: string;
}

export interface InputBoolean extends InputHelper {
  initial?: boolean;
}

export interface InputNumber extends InputHelper {
  min: number;
  max: number;
  step?: number;
  mode?: 'box' | 'slider';
  unit_of_measurement?: string;
  initial?: number;
}

export interface InputText extends InputHelper {
  mode?: 'text' | 'password';
  min?: number;
  max?: number;
  pattern?: string;
  initial?: string;
}

export interface InputSelect extends InputHelper {
  options: string[];
  initial?: string;
}

export interface InputDatetime extends InputHelper {
  has_date: boolean;
  has_time: boolean;
  initial?: string;
}

export interface Area {
  area_id: string;
  name: string;
  picture?: string | null;
}

export interface Zone {
  entity_id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  passive: boolean;
  icon?: string;
}

export interface Device {
  id: string;
  name: string;
  name_by_user?: string | null;
  area_id?: string | null;
  configuration_url?: string | null;
  config_entries: string[];
  connections: Array<[string, string]>;
  identifiers: Array<[string, string]>;
  manufacturer?: string | null;
  model?: string | null;
  sw_version?: string | null;
  hw_version?: string | null;
  via_device_id?: string | null;
  disabled_by?: string | null;
  entry_type?: string | null;
}

// Floor registry types (HA 2024.4+)
export interface Floor {
  floor_id: string;
  name: string;
  level?: number | null;
  icon?: string | null;
  aliases?: string[];
}

// Label registry types (HA 2024.4+)
export interface Label {
  label_id: string;
  name: string;
  icon?: string | null;
  color?: string | null;
  description?: string | null;
}
