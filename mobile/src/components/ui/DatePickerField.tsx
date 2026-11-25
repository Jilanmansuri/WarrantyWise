import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { TextInput } from 'react-native-paper';
import { Palette, Radii, Spacing } from '../../theme/tokens';
import { formatReadableDate, toIsoDateOnly } from '../../utils/dateUtils';

interface DatePickerFieldProps {
  label: string;
  value: string; // YYYY-MM-DD
  onChange: (isoDate: string) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  error?: string;
}

export function DatePickerField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  error,
}: DatePickerFieldProps) {
  const [showPicker, setShowPicker] = useState(false);

  const parsedDate = value ? new Date(`${value.slice(0, 10)}T00:00:00.000Z`) : new Date();
  const safeDate = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

  const handleNativeChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    if (event.type === 'set' && selectedDate) {
      onChange(toIsoDateOnly(selectedDate));
    }
  };

  if (Platform.OS === 'web') {
    return (
      <View style={styles.wrapper}>
        <TextInput
          mode="outlined"
          label={label}
          value={value}
          onChangeText={onChange}
          placeholder="YYYY-MM-DD"
          error={Boolean(error)}
          outlineStyle={styles.outline}
          right={<TextInput.Icon icon="calendar" />}
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={() => setShowPicker(true)}
        style={[styles.field, Boolean(error) && styles.fieldError]}
      >
        <Text style={styles.valueText}>{value ? formatReadableDate(value) : 'Select date'}</Text>
        <MaterialCommunityIcons name="calendar-outline" size={20} color={Palette.primary} />
      </Pressable>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {showPicker ? (
        <View style={Platform.OS === 'ios' ? styles.iosPickerContainer : undefined}>
          <DateTimePicker
            value={safeDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            onChange={handleNativeChange}
          />
          {Platform.OS === 'ios' ? (
            <Pressable onPress={() => setShowPicker(false)} style={styles.iosDone}>
              <Text style={styles.iosDoneText}>Done</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: Palette.textSecondary,
    marginBottom: 6,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  fieldError: {
    borderColor: Palette.danger,
  },
  valueText: {
    fontSize: 15,
    color: Palette.textPrimary,
    fontWeight: '500',
  },
  outline: {
    borderRadius: Radii.md,
  },
  errorText: {
    color: Palette.danger,
    fontSize: 12,
    marginTop: 4,
  },
  iosPickerContainer: {
    backgroundColor: Palette.surface,
    borderRadius: Radii.md,
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  iosDone: {
    alignSelf: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  iosDoneText: {
    color: Palette.primary,
    fontWeight: '700',
    fontSize: 14,
  },
});
