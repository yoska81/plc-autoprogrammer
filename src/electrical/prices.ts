/**
 * Verified list prices, by part number. Only prices read on the supplier's
 * own product page go here, with the page and the date they were read.
 * The price is per selling unit (each, or one pack for parts sold in packs).
 * Parts without an entry are shown as "price to confirm" — never estimated.
 */

export interface PartPrice {
  /** List price per selling unit. */
  price: number;
  currency: 'USD';
  /** Selling unit as shown by the supplier, e.g. "each", "pack of 100". */
  unit: string;
  /** Date the price was read (YYYY-MM-DD). */
  date: string;
  sourceUrl: string;
}

// Read from each part's automationdirect.com product page (JSON-LD offers.price, same as the
// displayed price) on the date given. Re-check before quoting: list prices change.
export const PRICES: Record<string, PartPrice> = {
  '100222015324006': { price: 31.0, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/valves/directional_control_solenoid_valves/solenoid_valves/100222015324006' },
  '14070520': { price: 8.0, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/circuit_protection_-z-_fuses_-z-_disconnects/disconnects_-a-_switches/disconnect_external_handles_-a-_components/14070520' },
  '14070532': { price: 9.0, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/circuit_protection_-z-_fuses_-z-_disconnects/disconnects_-a-_switches/disconnect_external_handles_-a-_components/14070532' },
  '14831111': { price: 28.0, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/circuit_protection_-z-_fuses_-z-_disconnects/disconnects_-a-_switches/disconnect_external_handles_-a-_components/14831111' },
  '22013003': { price: 75.0, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/circuit_protection_-z-_fuses_-z-_disconnects/disconnects_-a-_switches/non-fused_disconnects/22013003' },
  '22013006': { price: 87.0, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/circuit_protection_-z-_fuses_-z-_disconnects/disconnects_-a-_switches/non-fused_disconnects/22013006' },
  'C0-10DD1E-D': { price: 201.0, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/programmable_controllers/click_plcs_(stackable_micro_brick)/plc_units/c0-10dd1e-d' },
  'C0-11DD1E-D': { price: 233.0, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/programmable_controllers/click_plcs_(stackable_micro_brick)/plc_units/c0-11dd1e-d' },
  'C0-16ND3': { price: 69.0, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/programmable_controllers/click_plus_plcs_(stackable_micro_modular)/stackable_i-z-o_modules/c0-16nd3' },
  'C0-16TD1': { price: 70.0, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/programmable_controllers/click_plus_plcs_(stackable_micro_modular)/stackable_i-z-o_modules/c0-16td1' },
  'C18D-0P-1A': { price: 64.0, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/sensors_-z-_encoders/photoelectric_sensors/diffuse/c18d-0p-1a' },
  'CM5-T10W': { price: 785.0, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/hmi_(human_machine_interface)/graphical_hmi_devices/hmi_panels/cm5-t10w' },
  'CM5-T7W': { price: 499.0, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/hmi_(human_machine_interface)/graphical_hmi_devices/hmi_panels/cm5-t7w' },
  'CT-050-060-12-1': { price: 167.0, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/power_products_(electrical)/transformers/open_core_industrial_control_transformers/ct-050-060-12-1' },
  'DN-EB35': { price: 79.0, currency: 'USD', unit: 'pack of 50', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/wire_-a-_cable_termination/terminal_blocks/end_brackets/dn-eb35' },
  'DN-G10': { price: 232.0, currency: 'USD', unit: 'pack of 50', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/wire_-a-_cable_termination/terminal_blocks/grounding_terminal_blocks/dn-g10' },
  'DN-R35S1': { price: 42.5, currency: 'USD', unit: 'pack of 10', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/wire_-a-_cable_management/din_rail/din_rail/dn-r35s1' },
  'DN-T10-A': { price: 87.0, currency: 'USD', unit: 'pack of 100', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/wire_-a-_cable_termination/terminal_blocks/single-level_feedthrough_terminal_blocks/dn-t10-a' },
  'ECX1030-2': { price: 8.75, currency: 'USD', unit: 'pack of 2', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/pushbuttons_-z-_switches_-z-_indicators/pushbutton_-z-_switch_-z-_indicator_accessories/contact_blocks_-z-_mounting_flanges/ecx1030-2' },
  'EDCC5': { price: 191.0, currency: 'USD', unit: 'pack of 10', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/circuit_protection_-z-_fuses_-z-_disconnects/fuses/current_limiting_class_cc_fuses/edcc5' },
  'EHCC3DU': { price: 77.0, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/circuit_protection_-z-_fuses_-z-_disconnects/fuse_holders/modular_fuse_holders/ehcc3du' },
  'GCX1101': { price: 9.0, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/pushbuttons_-z-_switches_-z-_indicators/pushbuttons/gcx1101' },
  'GCX1102': { price: 9.0, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/pushbuttons_-z-_switches_-z-_indicators/pushbuttons/gcx1102' },
  'GCX1104': { price: 9.0, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/pushbuttons_-z-_switches_-z-_indicators/pushbuttons/gcx1104' },
  'GCX1131': { price: 17.5, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/pushbuttons_-z-_switches_-z-_indicators/emergency_stop_pushbuttons/gcx1131' },
  'GCX1231-24L': { price: 19.5, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/pushbuttons_-z-_switches_-z-_indicators/indicating_lights/gcx1231-24l' },
  'GCX1232-24L': { price: 19.5, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/pushbuttons_-z-_switches_-z-_indicators/indicating_lights/gcx1232-24l' },
  'GCX1300': { price: 12.0, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/pushbuttons_-z-_switches_-z-_indicators/selector_switches/gcx1300' },
  'GMCBU-1C-20': { price: 20.5, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/circuit_protection_-z-_fuses_-z-_disconnects/circuit_breakers_-a-_circuit_protectors/miniature_circuit_breakers_(mcb)/gmcbu-1c-20' },
  'GMCBU-1C-5': { price: 20.5, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/circuit_protection_-z-_fuses_-z-_disconnects/circuit_breakers_-a-_circuit_protectors/miniature_circuit_breakers_(mcb)/gmcbu-1c-5' },
  'GMCBU-3C-10': { price: 60.0, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/circuit_protection_-z-_fuses_-z-_disconnects/circuit_breakers_-a-_circuit_protectors/miniature_circuit_breakers_(mcb)/gmcbu-3c-10' },
  'GMCBU-3C-15': { price: 60.0, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/circuit_protection_-z-_fuses_-z-_disconnects/circuit_breakers_-a-_circuit_protectors/miniature_circuit_breakers_(mcb)/gmcbu-3c-15' },
  'GMCBU-3C-3': { price: 60.0, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/circuit_protection_-z-_fuses_-z-_disconnects/circuit_breakers_-a-_circuit_protectors/miniature_circuit_breakers_(mcb)/gmcbu-3c-3' },
  'GMCBU-3C-5': { price: 60.0, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/circuit_protection_-z-_fuses_-z-_disconnects/circuit_breakers_-a-_circuit_protectors/miniature_circuit_breakers_(mcb)/gmcbu-3c-5' },
  'GS23-45P0': { price: 399.0, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/drives_-a-_soft_starters/ac_variable_frequency_drives_(vfd)/general_purpose_vfds/gs23-45p0' },
  'KPR-SCS-24VACDC-1': { price: 9.5, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/relays_-z-_timers/electro-mechanical_relays/kpr-scs-24vacdc-1' },
  'LG5925-48-61-24': { price: 143.0, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/safety/safety_relay_modules/2-channel_e-stop_-z-_safety_gate_relays/lg5925-48-61-24' },
  'LR4-302WJNW-RYG': { price: 103.0, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/stacklights/signal_towers/lr4-302wjnw-ryg' },
  'PNK-AP-3H': { price: 29.5, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/sensors_-z-_encoders/inductive_proximity_sensors/18mm_tubular/pnk-ap-3h' },
  'PSL-24-060': { price: 69.0, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/power_products_(electrical)/dc_power_supplies/din_rail_mount/psl-24-060' },
  'PSR-24-120': { price: 70.0, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/power_products_(electrical)/dc_power_supplies/din_rail_mount/psr-24-120' },
  'PSR-24-120-3': { price: 105.0, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/power_products_(electrical)/dc_power_supplies/din_rail_mount/psr-24-120-3' },
  'PSR-24-240-3': { price: 156.0, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/power_products_(electrical)/dc_power_supplies/din_rail_mount/psr-24-240-3' },
  'SC-E02PG-24VDC': { price: 33.5, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/motor_controls/iec_magnetic_contactors/iec_contactors/sc-e02pg-24vdc' },
  'SC-E04PG-24VDC': { price: 65.0, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/motor_controls/iec_magnetic_contactors/iec_contactors/sc-e04pg-24vdc' },
  'SCE-16EL1206LP': { price: 258.0, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/enclosures_-a-_racks/wall-mount_enclosures/sce-16el1206lp' },
  'SCE-16P12': { price: 24.0, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/enclosures_-a-_racks/subpanels/sce-16p12' },
  'SCE-24EL2008LP': { price: 366.0, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/enclosures_-a-_racks/wall-mount_enclosures/sce-24el2008lp' },
  'SCE-24P20': { price: 74.0, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/enclosures_-a-_racks/subpanels/sce-24p20' },
  'SCE-36EL3012LP': { price: 705.0, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/enclosures_-a-_racks/wall-mount_enclosures/sce-36el3012lp' },
  'SCE-36P30': { price: 165.0, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/enclosures_-a-_racks/subpanels/sce-36p30' },
  'SCE-GB10': { price: 132.0, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/enclosures_-a-_racks/enclosure_parts_-a-_accessories/grounding_-a-_isolation/sce-gb10' },
  'T1-1530G-1': { price: 32.5, currency: 'USD', unit: 'each (one 6.5ft/2m duct section with cover)', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/wire_-a-_cable_management/wire_duct/wide_finger_wall/t1-1530g-1' },
  'T1-2240G-1': { price: 40.0, currency: 'USD', unit: 'each (one 6.5ft/2m duct section with cover)', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/wire_-a-_cable_management/wire_duct/wide_finger_wall/t1-2240g-1' },
  'TK-E02-1300': { price: 46.0, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/motor_controls/iec_overload_relays/thermal_overload_relays/tk-e02-1300' },
  'TK-E02-220': { price: 46.0, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/motor_controls/iec_overload_relays/thermal_overload_relays/tk-e02-220' },
  'TK-E02-340': { price: 46.0, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/motor_controls/iec_overload_relays/thermal_overload_relays/tk-e02-340' },
  'TK-E02-600': { price: 46.0, currency: 'USD', unit: 'each', date: '2026-10-16', sourceUrl: 'https://www.automationdirect.com/adc/shopping/catalog/motor_controls/iec_overload_relays/thermal_overload_relays/tk-e02-600' },
};

export const priceOf = (partNumber: string): PartPrice | undefined => PRICES[partNumber];
