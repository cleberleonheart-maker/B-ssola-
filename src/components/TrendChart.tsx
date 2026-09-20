import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';

type Props = {
  data: number[];
  height?: number;
  color: string;
  min?: number;
  max?: number;
};

const TrendChart = ({ data, height = 40, color, min: extMin, max: extMax }: Props) => {
  const bars = useMemo(() => {
    if (!data || data.length < 2) {
      return [];
    }
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of data) {
      if (Number.isFinite(v)) {
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    if (extMin != null && extMin < lo) lo = extMin;
    if (extMax != null && extMax > hi) hi = extMax;
    const range = hi - lo || 1;
    return data.map(v =>
      Number.isFinite(v) ? Math.max(0.06, Math.min(1, (v - lo) / range)) : 0,
    );
  }, [data, extMin, extMax]);

  if (bars.length === 0) {
    return <View style={[styles.row, { height }]} />;
  }

  return (
    <View style={[styles.row, { height }]}>
      {bars.map((ratio, i) => (
        <View
          key={i}
          style={[
            styles.bar,
            {
              height: `${ratio * 100}%`,
              backgroundColor: color,
            },
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 1.5,
    overflow: 'hidden',
    borderRadius: 3,
  },
  bar: {
    flex: 1,
    minWidth: 1,
    borderTopLeftRadius: 1,
    borderTopRightRadius: 1,
    opacity: 0.9,
  },
});

export default TrendChart;