export type IOType = 'input' | 'output';

export type IOCategory =
  | 'Safety'
  | 'Operator/HMI'
  | 'External Machine'
  | 'Product Detection'
  | 'Conveyor'
  | 'Pneumatic'
  | 'Vacuum'
  | 'Servo/Axis'
  | 'Station 1'
  | 'Station 2'
  | 'Analog/Process'
  | 'Spare';

export interface IOPoint {
  id: string;
  description: string;
  type: IOType;
  category: IOCategory;
}

export interface TemplatePoint {
  templateId: string;
  description: string;
  type: IOType;
  category: IOCategory;
}
