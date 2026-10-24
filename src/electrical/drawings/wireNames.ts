import { createContext, useContext } from 'react';
import { ioLabel, type IoNames } from '../ioNames';

/** The PLC's own I/O names of the drawing set (ioNames.ts): wire numbers drawn on a sheet follow the wire list. */
export const WireNamesContext = createContext<IoNames>({ native: new Map(), wire: new Map() });

/** An I/O address as the PLC names it (%I0.0 on an S7), for text on a sheet. */
export function useIoLabel(): (address: string) => string {
  const names = useContext(WireNamesContext);
  return (a) => ioLabel(names, a);
}
