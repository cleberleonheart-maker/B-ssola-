import React, {
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { spacing, radius } from '../theme/colors';
import { useAssistant } from '../assistant/AssistantContext';
import type { ChatMessage } from '../assistant/types';
import KeferaAvatar from './KeferaAvatar';
import { formatTime } from '../utils/compass';

const SUGGESTION_KEYS = [
  'as_sug_1',
  'as_sug_2',
  'as_sug_3',
  'as_sug_4',
  'as_sug_5',
];

const PulseRing = ({
  color,
  size,
  active,
  duration = 1800,
  startScale = 1,
  endScale = 2,
}: {
  color: string;
  size: number;
  active: boolean;
  duration?: number;
  startScale?: number;
  endScale?: number;
}) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      anim.stopAnimation();
      anim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [active, anim, duration]);

  const scale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [startScale, endScale],
  });
  const opacity = anim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0.55, 0.28, 0],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: color,
        transform: [{ scale }],
        opacity,
      }}
    />
  );
};

const Waveform = ({ color, active }: { color: string; active: boolean }) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const barsRef = useRef<Animated.Value[]>([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]);
  const bars = barsRef.current;

  useEffect(() => {
    bars.forEach(v => {
      v.stopAnimation();
      v.setValue(0);
    });
    if (!active) {
      return;
    }
    const loops = bars.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, {
            toValue: 1,
            duration: 260 + i * 70,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0,
            duration: 260 + i * 70,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    loops.forEach(loop => loop.start());
    return () => loops.forEach(loop => loop.stop());
  }, [active, bars]);

  return (
    <View style={styles.waveRow}>
      {bars.map((v, i) => (
        <Animated.View
          key={i}
          style={[
            styles.waveBar,
            {
              backgroundColor: color,
              transform: [
                {
                  scaleY: v.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.3, 1],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
};

const AssistantModal = () => {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    open,
    setOpen,
    messages,
    send,
    clear,
    ready,
    listening,
    voiceSupported,
    toggleVoice,
    wakeOn,
    toggleWake,
  } = useAssistant();
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [kbVisible, setKbVisible] = useState(false);
  const scrollRef = useRef<ScrollViewInstance | null>(null);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKbVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const handleRequestClose = useCallback(() => {
    if (kbVisible) {
      Keyboard.dismiss();
    } else {
      setOpen(false);
    }
  }, [kbVisible, setOpen]);

  useEffect(() => {
    if (open) {
      setInput('');
      setThinking(false);
    }
  }, [open]);

  const runSend = useCallback(
    async (text: string) => {
      setThinking(true);
      try {
        await send(text);
      } finally {
        setThinking(false);
      }
    },
    [send],
  );

  const handleSend = async () => {
    const text = input.trim();
    if (!text) {
      return;
    }
    setInput('');
    await runSend(text);
  };

  const handleMic = async () => {
    await toggleVoice();
  };

  const headerSubtitle = (() => {
    if (listening) {
      return t('as_input_listening');
    }
    if (wakeOn && voiceSupported) {
      return t('ui_wake_hint');
    }
    if (!ready) {
      return t('as_chat_loading');
    }
    return t('as_chat_subtitle');
  })();

  const statusColor = listening ? colors.danger : colors.success;

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={handleRequestClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.root}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />

        <View
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + spacing.sm },
          ]}>
          <View style={styles.glowOne} pointerEvents="none" />
          <View style={styles.glowTwo} pointerEvents="none" />

          <View style={styles.handle} />

          <View style={styles.header}>
<View style={styles.avatarWrap}>
                {ready && (
                  <PulseRing
                    color={listening ? colors.danger : colors.accent}
                    size={56}
                    active
                    duration={listening ? 1200 : 2600}
                    startScale={1.05}
                    endScale={1.9}
                  />
                )}
                <KeferaAvatar size={48} listening={listening} dim={!ready} />
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: statusColor },
                  ]}
                />
              </View>

            <View style={styles.headerText}>
              <Text style={styles.title}>KEFERA</Text>
              <View style={styles.subtitleWrap}>
                <View style={[styles.subtitleDot, { backgroundColor: statusColor }]} />
                <Text style={styles.subtitle} numberOfLines={1}>
                  {headerSubtitle}
                </Text>
              </View>
            </View>

            <View style={styles.headerActions}>
              <Pressable
                onPress={toggleWake}
                hitSlop={8}
                style={[styles.iconButton, wakeOn && styles.wakeButtonActive]}
                accessibilityLabel={
                  wakeOn ? t('as_wake_on_label') : t('as_wake_off_label')
                }>
                <Text style={styles.iconBadge}>{wakeOn ? '👂' : '🙉'}</Text>
              </Pressable>
              <Pressable onPress={clear} hitSlop={8} style={styles.iconButton}>
                <Text style={styles.iconBadge}>🗑</Text>
              </Pressable>
              <Pressable
                onPress={() => setOpen(false)}
                hitSlop={8}
                style={styles.iconButton}>
                <Text style={styles.iconBadge}>✕</Text>
              </Pressable>
            </View>
          </View>

          {ready && (
            <Waveform color={listening ? colors.danger : colors.accent} active={listening} />
          )}

          <ScrollView
            ref={scrollRef}
            style={styles.messagesArea}
            contentContainerStyle={styles.messagesContent}
            onContentSizeChange={() =>
              scrollRef.current?.scrollToEnd({ animated: true })
            }>
            {!ready ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : messages.length === 0 ? (
              <View style={styles.empty}>
<View style={styles.heroRing}>
                    <PulseRing
                      color={colors.primary}
                      size={104}
                      active
                      duration={2600}
                      startScale={1}
                      endScale={1.35}
                    />
                    <KeferaAvatar size={84} listening={listening} />
                  </View>
                <Text style={styles.emptyHello}>{t('as_empty_intro')}</Text>
                <Text style={styles.emptyHint}>{t('as_empty_hint')}</Text>
                <View style={styles.chips}>
                  {SUGGESTION_KEYS.map(key => {
                    const suggestion = t(key);
                    return (
                      <Pressable
                        key={key}
                        onPress={() => {
                          setInput('');
                          runSend(suggestion);
                        }}
                        style={styles.chip}>
                        <Text style={styles.chipText}>{suggestion}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : (
              <React.Fragment>
                {messages.map(msg => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
                {thinking && <ThinkingBubble />}
              </React.Fragment>
            )}
          </ScrollView>

          <View style={styles.inputRow}>
            <Pressable
              onPress={handleMic}
              disabled={!voiceSupported || !ready}
              style={[
                styles.micButton,
                listening && styles.micButtonActive,
                (!voiceSupported || !ready) && styles.micButtonDisabled,
              ]}>
              <Text style={styles.micIcon}>{listening ? '🔴' : '🎤'}</Text>
            </Pressable>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder={
                listening
                  ? t('as_input_listening')
                  : t('as_input_placeholder')
              }
              placeholderTextColor={colors.textMuted}
              multiline
              onSubmitEditing={handleSend}
              returnKeyType="send"
            />
            <Pressable
              onPress={handleSend}
              disabled={!input.trim()}
              style={[
                styles.sendButton,
                !input.trim() && styles.sendButtonDisabled,
              ]}>
              <Text style={styles.sendIcon}>➤</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const ThinkingBubble = () => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.bubbleRow}>
      <View style={styles.bubbleAvatar}>
        <KeferaAvatar size={26} />
      </View>
      <View style={styles.bubbleGroup}>
        <View style={[styles.bubble, styles.bubbleAssistant, styles.thinkingBubble]}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      </View>
    </View>
  );
};

const MessageBubble = ({ message }: { message: ChatMessage }) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isUser = message.role === 'user';

  return (
    <View
      style={[
        styles.bubbleRow,
        isUser ? styles.bubbleRowUser : styles.bubbleRowAssistant,
      ]}>
      {!isUser && (
        <View style={styles.bubbleAvatar}>
          <KeferaAvatar size={26} />
        </View>
      )}
      <View style={styles.bubbleGroup}>
        <View
          style={[
            styles.bubble,
            isUser ? styles.bubbleUser : styles.bubbleAssistant,
          ]}>
          <Text
            style={[
              styles.bubbleText,
              isUser ? styles.bubbleTextUser : styles.bubbleTextAssistant,
            ]}>
            {message.text}
          </Text>
          {message.speak && !isUser && (
            <Text style={styles.speakMark}>🔊</Text>
          )}
        </View>
        <Text style={styles.timeLabel}>{formatTime(message.at)}</Text>
      </View>
    </View>
  );
};

const createStyles = (colors: {
  background: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  primary: string;
  accent: string;
  north: string;
  border: string;
  success: string;
  danger: string;
}) =>
  StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      maxHeight: '88%',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      overflow: 'hidden',
    },
    glowOne: {
      position: 'absolute',
      top: -70,
      right: -70,
      width: 200,
      height: 200,
      borderRadius: 100,
      backgroundColor: colors.accent,
      opacity: 0.09,
    },
    glowTwo: {
      position: 'absolute',
      top: 40,
      left: -90,
      width: 200,
      height: 200,
      borderRadius: 100,
      backgroundColor: colors.primary,
      opacity: 0.07,
    },
    handle: {
      alignSelf: 'center',
      width: 48,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    avatarWrap: {
      width: 56,
      height: 56,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusDot: {
      position: 'absolute',
      right: 2,
      bottom: 4,
      width: 13,
      height: 13,
      borderRadius: 6.5,
      borderWidth: 2,
      borderColor: colors.surface,
    },
    headerText: {
      flex: 1,
      marginLeft: spacing.md,
    },
    title: {
      fontSize: 20,
      fontWeight: '900',
      color: colors.text,
      letterSpacing: 3,
      textShadowColor: colors.primary,
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 8,
    },
    subtitleWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 3,
    },
    subtitleDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginRight: spacing.xs,
    },
    subtitle: {
      fontSize: 12,
      color: colors.textMuted,
    },
    headerActions: {
      flexDirection: 'row',
      marginLeft: spacing.sm,
    },
    iconButton: {
      width: 36,
      height: 36,
      borderRadius: radius.full,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: spacing.sm,
    },
    iconBadge: {
      fontSize: 15,
    },
    wakeButtonActive: {
      borderColor: colors.success,
      backgroundColor: colors.surfaceAlt,
    },
    waveRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 26,
      marginBottom: spacing.sm,
      opacity: 0.8,
    },
    waveBar: {
      width: 4,
      height: 22,
      borderRadius: 2,
      marginHorizontal: 3,
    },
    messagesArea: {
      flexGrow: 0,
    },
    messagesContent: {
      paddingVertical: spacing.sm,
    },
    loadingWrap: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
    },
    empty: {
      alignItems: 'center',
      paddingVertical: spacing.lg,
    },
    heroRing: {
      width: 104,
      height: 104,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    emptyHello: {
      color: colors.text,
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
    },
    emptyHint: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: spacing.sm,
      textAlign: 'center',
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      marginTop: spacing.md,
    },
    chip: {
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.full,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginRight: spacing.sm,
      marginBottom: spacing.sm,
    },
    chipText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
    },
    bubbleRow: {
      flexDirection: 'row',
      marginBottom: spacing.md,
      alignItems: 'flex-end',
    },
    bubbleRowUser: {
      justifyContent: 'flex-end',
    },
    bubbleRowAssistant: {
      justifyContent: 'flex-start',
    },
    bubbleAvatar: {
      width: 26,
      height: 26,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
      marginBottom: 14,
      overflow: 'hidden',
    },
    bubbleGroup: {
      maxWidth: '78%',
      alignItems: 'flex-start',
    },
    bubble: {
      maxWidth: '100%',
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    bubbleUser: {
      backgroundColor: colors.primary,
      borderBottomRightRadius: 4,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 3,
    },
    bubbleAssistant: {
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      borderBottomLeftRadius: 4,
    },
    bubbleText: {
      fontSize: 14,
      lineHeight: 20,
    },
    bubbleTextUser: {
      color: colors.surface,
      fontWeight: '600',
    },
    bubbleTextAssistant: {
      color: colors.text,
    },
    speakMark: {
      fontSize: 12,
      marginLeft: spacing.sm,
    },
    thinkingBubble: {
      minWidth: 56,
      alignItems: 'center',
    },
    timeLabel: {
      fontSize: 10,
      color: colors.textMuted,
      marginTop: 3,
      marginHorizontal: 4,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    micButton: {
      width: 42,
      height: 42,
      borderRadius: radius.full,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    micButtonActive: {
      borderColor: colors.danger,
      backgroundColor: colors.surfaceAlt,
      shadowColor: colors.danger,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 8,
      elevation: 4,
    },
    micButtonDisabled: {
      opacity: 0.4,
    },
    micIcon: {
      fontSize: 18,
    },
    input: {
      flex: 1,
      minHeight: 42,
      maxHeight: 110,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingTop: Platform.OS === 'ios' ? 11 : 8,
      paddingBottom: 8,
      color: colors.text,
      fontSize: 14,
    },
    sendButton: {
      width: 42,
      height: 42,
      borderRadius: radius.full,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: spacing.sm,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.7,
      shadowRadius: 10,
      elevation: 4,
    },
    sendButtonDisabled: {
      opacity: 0.4,
      shadowOpacity: 0,
    },
    sendIcon: {
      fontSize: 16,
      color: colors.surface,
      fontWeight: '900',
    },
  });

export default AssistantModal;