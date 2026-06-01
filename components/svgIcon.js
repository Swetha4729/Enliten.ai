import { svgMap } from '@/components/svgMap';

export default function SvgIcon({ iconName,width=100,height=100 }) {
    const SvgComponent = svgMap[iconName];
  
    return SvgComponent ? <SvgComponent width={width} height={height} /> : null;
}