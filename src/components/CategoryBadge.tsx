import type { IOCategory } from '../types/io';

const CATEGORY_COLORS: Record<IOCategory, string> = {
  'Safety': 'bg-red-100 text-red-800',
  'Operator/HMI': 'bg-blue-100 text-blue-800',
  'External Machine': 'bg-purple-100 text-purple-800',
  'Product Detection': 'bg-green-100 text-green-800',
  'Conveyor': 'bg-orange-100 text-orange-800',
  'Pneumatic': 'bg-cyan-100 text-cyan-800',
  'Vacuum': 'bg-teal-100 text-teal-800',
  'Servo/Axis': 'bg-indigo-100 text-indigo-800',
  'Station 1': 'bg-yellow-100 text-yellow-800',
  'Station 2': 'bg-amber-100 text-amber-800',
  'Analog/Process': 'bg-pink-100 text-pink-800',
  'Spare': 'bg-gray-100 text-gray-600',
};

export function CategoryBadge({ category }: { category: IOCategory }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[category]}`}>
      {category}
    </span>
  );
}

export { CATEGORY_COLORS };
