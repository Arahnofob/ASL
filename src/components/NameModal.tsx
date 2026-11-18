import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useTheme } from '../lib/store';

/** Small text prompt (Alert.prompt only exists on iOS and can't be themed). */
export function NameModal(props: { visible: boolean; title: string; initial?: string; confirm?: string; onCancel: () => void; onSubmit: (v: string) => void }) {
  return (
    <Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onCancel}>
      {props.visible ? <Prompt {...props} /> : null}
    </Modal>
  );
}

function Prompt({ title, initial = '', confirm = 'Save', onCancel, onSubmit }: { title: string; initial?: string; confirm?: string; onCancel: () => void; onSubmit: (v: string) => void }) {
  const t = useTheme();
  const [v, setV] = useState(initial);
  const submit = () => v.trim() && onSubmit(v.trim());
  return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', padding: 32 }}>
        <View style={{ backgroundColor: t.card, borderRadius: 14, padding: 18, gap: 14 }}>
          <Text style={{ color: t.text, fontSize: 17, fontWeight: '600', textAlign: 'center' }}>{title}</Text>
          <TextInput
            value={v}
            onChangeText={setV}
            autoFocus
            onSubmitEditing={submit}
            returnKeyType="done"
            style={{ color: t.text, fontSize: 16, borderWidth: 1, borderColor: t.border, borderRadius: 8, padding: 10 }}
            placeholderTextColor={t.muted}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 24 }}>
            <Pressable onPress={onCancel} hitSlop={8}>
              <Text style={{ color: t.accent, fontSize: 17 }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={submit} hitSlop={8}>
              <Text style={{ color: t.accent, fontSize: 17, fontWeight: '600', opacity: v.trim() ? 1 : 0.4 }}>{confirm}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
  );
}
