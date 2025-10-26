// ABOUTME: System layer type definitions for HA lifecycle operations
// ABOUTME: Types for add-ons, integrations, backups, HACS

export interface AddonInfo {
  slug: string;
  name: string;
  description: string;
  version: string;
  state: 'started' | 'stopped';
  installed: boolean;
  available: boolean;
  icon?: boolean;
  logo?: boolean;
  repository?: string;
}

export interface IntegrationInfo {
  domain: string;
  name: string;
  version?: string;
  config_entries: ConfigEntry[];
  documentation?: string;
  issue_tracker?: string;
}

export interface ConfigEntry {
  entry_id: string;
  domain: string;
  title: string;
  source: string;
  state: string;
  supports_options: boolean;
  supports_remove_device: boolean;
  supports_unload: boolean;
  pref_disable_new_entities: boolean;
  pref_disable_polling: boolean;
  disabled_by: string | null;
  reason: string | null;
}

export interface BackupInfo {
  slug: string;
  name: string;
  date: string;
  size: number;
  type: 'full' | 'partial';
  protected: boolean;
  compressed: boolean;
  homeassistant?: string;
  addons?: Array<{
    slug: string;
    name: string;
    version: string;
  }>;
  folders?: string[];
}

export interface HACSRepository {
  id: string;
  name: string;
  full_name: string;
  description: string;
  category: string;
  installed: boolean;
  installed_version?: string;
  available_version?: string;
  new: boolean;
  stars: number;
  authors: string[];
  domain?: string;
}
