import React, { useState } from 'react';
import { LinearGradient, type LinearGradientProps } from 'expo-linear-gradient';

/** CSS angle projection, including the rectangle's aspect ratio. */
export function gradientPoints(angle: number, width: number, height: number) {
  const radians = angle * Math.PI / 180;
  const dx = Math.sin(radians), dy = -Math.cos(radians);
  const length = Math.abs(width * dx) + Math.abs(height * dy);
  const x = dx * length / (2 * width), y = dy * length / (2 * height);
  return { start: { x: 0.5 - x, y: 0.5 - y }, end: { x: 0.5 + x, y: 0.5 + y } };
}

export function FigmaGradient({ angle = 120, onLayout, ...props }: LinearGradientProps & { angle?: number }) {
  const [size, setSize] = useState({ width: 1, height: 1 });
  return <LinearGradient {...props} {...gradientPoints(angle, size.width, size.height)} onLayout={event => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) setSize(previous => previous.width === width && previous.height === height ? previous : { width, height });
    onLayout?.(event);
  }} />;
}
