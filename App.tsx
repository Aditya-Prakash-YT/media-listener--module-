import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, Image,
  PanResponder, Modal, TextInput, KeyboardAvoidingView, Platform,
  useWindowDimensions, AppState, AppStateStatus, StatusBar as RNStatusBar,
  ScrollView, Share, Animated, Easing
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Icon from '@react-native-vector-icons/material-design-icons';
import * as MediaSession from './modules/media-session';

// ─── Monochrome Theme (Sober, Minimalist, Precision Audio) ──
const COLORS = {
  background: '#000000',
  surface: '#0A0A0A',
  surfaceLight: '#141414',
  border: '#222222',
  borderStrong: '#333333',
  primary: '#FFFFFF',
  secondary: '#888888',
  muted: '#444444',
  subtle: '#1C1C1C',
};

// ─── Player Name Formatter ───────────────────────────────────
function formatPlayerName(packageName?: string): string {
  if (!packageName) return 'MEDIA SESSION';
  const pkg = packageName.toLowerCase();

  if (pkg.includes('spotify')) return 'SPOTIFY';
  if (pkg.includes('youtube.music') || pkg.includes('music.youtube')) return 'YOUTUBE MUSIC';
  if (pkg.includes('youtube')) return 'YOUTUBE';
  if (pkg.includes('apple.music')) return 'APPLE MUSIC';
  if (pkg.includes('soundcloud')) return 'SOUNDCLOUD';
  if (pkg.includes('sec.android.app.music') || pkg.includes('samsung')) return 'SAMSUNG MUSIC';
  if (pkg.includes('amazon')) return 'AMAZON MUSIC';
  if (pkg.includes('audible')) return 'AUDIBLE';
  if (pkg.includes('vlc')) return 'VLC';

  const segments = packageName.split('.');
  const candidate = segments[segments.length - 1] || 'AUDIO PLAYER';
  return candidate.replace(/[^a-zA-Z0-9]/g, ' ').trim().toUpperCase();
}

// ─── Time Formatting ─────────────────────────────────────────
const formatTime = (ms: number): string => {
  if (typeof ms !== 'number' || isNaN(ms) || ms < 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// ─── Minimalist Level Meter (No Gamer Glows) ──────────────────
function MinimalistLevelMeter({ isPlaying }: { isPlaying: boolean }) {
  const animValues = useRef([
    new Animated.Value(4),
    new Animated.Value(10),
    new Animated.Value(16),
    new Animated.Value(8),
  ]).current;

  useEffect(() => {
    if (!isPlaying) {
      animValues.forEach(v => v.setValue(2));
      return;
    }

    const animations = animValues.map((v, i) => {
      const minH = 3 + i * 2;
      const maxH = 14 + (i % 2) * 4;
      return Animated.loop(
        Animated.sequence([
          Animated.timing(v, {
            toValue: maxH,
            duration: 380 + (i * 110),
            easing: Easing.linear,
            useNativeDriver: false,
          }),
          Animated.timing(v, {
            toValue: minH,
            duration: 380 + (i * 110),
            easing: Easing.linear,
            useNativeDriver: false,
          }),
        ])
      );
    });

    Animated.parallel(animations).start();

    return () => {
      animations.forEach(a => a.stop());
    };
  }, [isPlaying, animValues]);

  return (
    <View style={styles.meterContainer}>
      {animValues.map((anim, idx) => (
        <Animated.View
          key={idx}
          style={[
            styles.meterBar,
            {
              height: anim,
              backgroundColor: isPlaying ? COLORS.primary : COLORS.muted,
            },
          ]}
        />
      ))}
    </View>
  );
}

// ─── PermissionCard ──────────────────────────────────────────
function PermissionCard() {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>NOTIFICATION ACCESS REQUIRED</Text>
      <Text style={styles.cardDesc}>
        Android restricts active media session observation to apps with Notification Access. This permission is required to detect track title, artist, and playback state.
      </Text>
      <View style={styles.privacyBox}>
        <Text style={styles.privacyTitle}>PRIVACY GUARANTEE</Text>
        <Text style={styles.privacyDesc}>
          This app operates strictly as a media controller. It never reads, logs, or transmits personal messages, notifications, or verification codes.
        </Text>
      </View>
      <TouchableOpacity style={styles.primaryButton} onPress={() => MediaSession.requestPermission()} activeOpacity={0.8}>
        <Text style={styles.primaryButtonText}>GRANT ACCESS</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── IdleView ────────────────────────────────────────────────
function IdleView({ onRefresh }: { onRefresh: () => void }) {
  return (
    <View style={styles.idleView}>
      <Text style={styles.idleMessage}>READY FOR PLAYBACK</Text>
      <Text style={styles.idleSubMessage}>No active media session detected on device.</Text>
      <Text style={styles.idleHint}>Start playback in Spotify, YouTube, or another player.</Text>
      <TouchableOpacity style={styles.secondaryButton} onPress={onRefresh} activeOpacity={0.8}>
        <Text style={styles.secondaryButtonText}>SYNC STATE</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── SeekModal ───────────────────────────────────────────────
interface SeekModalProps {
  visible: boolean;
  duration: number;
  onSeek: (positionMs: number) => void;
  onClose: () => void;
}

function SeekModal({ visible, duration, onSeek, onClose }: SeekModalProps) {
  const [seekToTime, setSeekToTime] = useState('');

  const handleSubmit = useCallback(() => {
    if (!seekToTime) return;

    let seconds = 0;
    if (seekToTime.includes(':')) {
      const parts = seekToTime.split(':');
      if (parts.length === 3) {
        seconds = parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
      } else if (parts.length === 2) {
        seconds = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
      }
    } else {
      seconds = parseFloat(seekToTime);
    }

    if (!isNaN(seconds)) {
      const ms = seconds * 1000;
      const clamped = Math.min(Math.max(0, ms), duration);
      onSeek(clamped);
    }

    setSeekToTime('');
    onClose();
  }, [seekToTime, duration, onSeek, onClose]);

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>JUMP TO POSITION</Text>
          <Text style={styles.modalSubtitle}>Format: MM:SS or raw seconds (Max: {formatTime(duration)})</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="0:00"
            placeholderTextColor={COLORS.muted}
            keyboardType="numeric"
            value={seekToTime}
            onChangeText={setSeekToTime}
            autoFocus
            onSubmitEditing={handleSubmit}
          />
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalSecondaryBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.modalSecondaryText}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalPrimaryBtn} onPress={handleSubmit} activeOpacity={0.8}>
              <Text style={styles.modalPrimaryText}>APPLY</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Technical Inspector Modal (Utilitarian Architecture) ───
interface InspectorModalProps {
  visible: boolean;
  mediaData: MediaSession.MediaEvent | null;
  onClose: () => void;
}

function InspectorModal({ visible, mediaData, onClose }: InspectorModalProps) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { maxHeight: '85%' }]}>
          <View style={styles.modalHeaderRow}>
            <Text style={styles.modalTitle}>NATIVE SESSION INSPECTOR</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Icon name="close" size={18} color={COLORS.secondary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.modalSubtitle}>Real-time parameters from Android MediaController</Text>

          <ScrollView style={styles.techScroll}>
            {mediaData ? (
              <View style={styles.techTable}>
                <View style={styles.techRow}>
                  <Text style={styles.techKey}>PACKAGE</Text>
                  <Text style={styles.techVal}>{mediaData.package}</Text>
                </View>
                <View style={styles.techRow}>
                  <Text style={styles.techKey}>STATE</Text>
                  <Text style={styles.techValHighlight}>{mediaData.state.toUpperCase()}</Text>
                </View>
                <View style={styles.techRow}>
                  <Text style={styles.techKey}>TITLE</Text>
                  <Text style={styles.techVal}>{mediaData.title || '(none)'}</Text>
                </View>
                <View style={styles.techRow}>
                  <Text style={styles.techKey}>ARTIST</Text>
                  <Text style={styles.techVal}>{mediaData.artist || '(none)'}</Text>
                </View>
                <View style={styles.techRow}>
                  <Text style={styles.techKey}>ALBUM</Text>
                  <Text style={styles.techVal}>{mediaData.album || '(none)'}</Text>
                </View>
                <View style={styles.techRow}>
                  <Text style={styles.techKey}>POSITION</Text>
                  <Text style={styles.techValMono}>{mediaData.position} ms ({formatTime(mediaData.position)})</Text>
                </View>
                <View style={styles.techRow}>
                  <Text style={styles.techKey}>DURATION</Text>
                  <Text style={styles.techValMono}>{mediaData.duration} ms ({formatTime(mediaData.duration)})</Text>
                </View>
                <View style={styles.techRow}>
                  <Text style={styles.techKey}>TIMESTAMP</Text>
                  <Text style={styles.techValMono}>{mediaData.timestamp}</Text>
                </View>
                <View style={[styles.techRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.techKey}>ARTWORK</Text>
                  <Text style={styles.techValMonoSmall} numberOfLines={2}>
                    {mediaData.artworkUri || '(none)'}
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={styles.emptyText}>NO ACTIVE SESSION</Text>
            )}
          </ScrollView>

          <TouchableOpacity style={styles.primaryButton} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.primaryButtonText}>CLOSE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── History Sheet Modal (Minimalist Track Log) ──────────────
interface HistoryModalProps {
  visible: boolean;
  history: MediaSession.MediaEvent[];
  onClose: () => void;
  onClear: () => void;
}

function HistoryModal({ visible, history, onClose, onClear }: HistoryModalProps) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { maxHeight: '85%' }]}>
          <View style={styles.modalHeaderRow}>
            <Text style={styles.modalTitle}>INTERCEPTED TRACK LOG</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Icon name="close" size={18} color={COLORS.secondary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.modalSubtitle}>Media tracks intercepted during this session ({history.length})</Text>

          <ScrollView style={styles.techScroll}>
            {history.length === 0 ? (
              <Text style={styles.emptyText}>NO TRACKS LOGGED</Text>
            ) : (
              history.map((item, idx) => (
                <View key={`${item.title}-${item.timestamp}-${idx}`} style={styles.logItem}>
                  <View style={styles.logIndex}>
                    <Text style={styles.logIndexText}>{(idx + 1).toString().padStart(2, '0')}</Text>
                  </View>
                  <View style={styles.logContent}>
                    <Text style={styles.logTitle} numberOfLines={1}>{item.title || 'Untitled Track'}</Text>
                    <Text style={styles.logArtist} numberOfLines={1}>
                      {item.artist || 'Unknown Artist'} • {formatPlayerName(item.package)}
                    </Text>
                  </View>
                  <Text style={styles.logTime}>
                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalSecondaryBtn} onPress={onClear} activeOpacity={0.8}>
              <Text style={styles.modalSecondaryText}>CLEAR</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalPrimaryBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.modalPrimaryText}>DONE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── PlayerControls ──────────────────────────────────────────
interface PlayerControlsProps {
  state: string;
  onQuickRewind: () => void;
  onQuickForward: () => void;
}

function PlayerControls({ state, onQuickRewind, onQuickForward }: PlayerControlsProps) {
  const isPlaying = state === 'playing';

  return (
    <View style={styles.controlsRow}>
      {/* -10s Jump */}
      <TouchableOpacity onPress={onQuickRewind} style={styles.discreteButton} activeOpacity={0.7}>
        <Text style={styles.discreteButtonText}>-10s</Text>
      </TouchableOpacity>

      {/* Skip Previous */}
      <TouchableOpacity onPress={() => MediaSession.skipPrevious()} style={styles.iconButton} activeOpacity={0.7}>
        <Icon name="skip-previous" size={26} color={COLORS.primary} />
      </TouchableOpacity>

      {/* Play / Pause Toggle (Solid high contrast) */}
      <TouchableOpacity
        onPress={() => isPlaying ? MediaSession.pause() : MediaSession.play()}
        style={styles.playButton}
        activeOpacity={0.8}
      >
        <Icon
          name={isPlaying ? 'pause' : 'play'}
          size={30}
          color={COLORS.background}
        />
      </TouchableOpacity>

      {/* Skip Next */}
      <TouchableOpacity onPress={() => MediaSession.skipNext()} style={styles.iconButton} activeOpacity={0.7}>
        <Icon name="skip-next" size={26} color={COLORS.primary} />
      </TouchableOpacity>

      {/* +10s Jump */}
      <TouchableOpacity onPress={onQuickForward} style={styles.discreteButton} activeOpacity={0.7}>
        <Text style={styles.discreteButtonText}>+10s</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── ProgressBar ─────────────────────────────────────────────
interface ProgressBarProps {
  displayPosition: number;
  duration: number;
  onSeekCommit: (positionMs: number) => void;
  onSeekStart: () => void;
  onSeekEnd: () => void;
  onTimeTap: () => void;
}

function ProgressBar({
  displayPosition, duration, onSeekCommit, onSeekStart, onSeekEnd, onTimeTap,
}: ProgressBarProps) {
  const trackRef = useRef<any>(null);
  const trackLayoutRef = useRef({ width: 0, pageX: 0 });
  const [localPosition, setLocalPosition] = useState(displayPosition);
  const isSeekingRef = useRef(false);

  useEffect(() => {
    if (!isSeekingRef.current) {
      setLocalPosition(displayPosition);
    }
  }, [displayPosition]);

  const durationRef = useRef(duration);
  durationRef.current = duration;

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      isSeekingRef.current = true;
      onSeekStart();
      trackRef.current?.measure((_x: number, _y: number, w: number, _h: number, pageX: number) => {
        trackLayoutRef.current = { width: w, pageX };
        if (durationRef.current > 0) {
          const relativeX = evt.nativeEvent.pageX - pageX;
          const pct = Math.max(0, Math.min(1, relativeX / w));
          setLocalPosition(Math.floor(pct * durationRef.current));
        }
      });
    },
    onPanResponderMove: (evt) => {
      const { width, pageX } = trackLayoutRef.current;
      if (!width || durationRef.current <= 0) return;
      const relativeX = evt.nativeEvent.pageX - pageX;
      const pct = Math.max(0, Math.min(1, relativeX / width));
      setLocalPosition(Math.floor(pct * durationRef.current));
    },
    onPanResponderRelease: (evt, gesture) => {
      const { width, pageX } = trackLayoutRef.current;
      if (!width || durationRef.current <= 0) {
        isSeekingRef.current = false;
        onSeekEnd();
        return;
      }
      let targetPos: number;
      if (gesture.dx !== 0 || gesture.dy !== 0) {
        const relativeX = evt.nativeEvent.pageX - pageX;
        const pct = Math.max(0, Math.min(1, relativeX / width));
        targetPos = Math.floor(pct * durationRef.current);
      } else {
        targetPos = localPosition;
      }
      onSeekCommit(targetPos);
      setLocalPosition(targetPos);
      setTimeout(() => {
        isSeekingRef.current = false;
        onSeekEnd();
      }, 500);
    },
  }), [onSeekStart, onSeekEnd, onSeekCommit, localPosition]);

  const progressPct = duration > 0 ? Math.min((localPosition / duration) * 100, 100) : 0;

  return (
    <View style={styles.progressContainer}>
      <View {...panResponder.panHandlers} style={styles.progressTouchArea}>
        <View
          style={styles.progressTrack}
          ref={trackRef}
          onLayout={() => {
            trackRef.current?.measure((_x: number, _y: number, w: number, _h: number, pageX: number) => {
              trackLayoutRef.current = { width: w, pageX };
            });
          }}
        >
          <View style={[styles.progressThumb, { width: `${progressPct}%` }]}>
            <View style={styles.thumbKnob} />
          </View>
        </View>
      </View>
      <View style={styles.timeLabels}>
        <TouchableOpacity onPress={onTimeTap} activeOpacity={0.7}>
          <Text style={[styles.timeValue, styles.timeInteractive]}>{formatTime(localPosition)}</Text>
        </TouchableOpacity>
        <Text style={styles.timeValue}>{formatTime(duration)}</Text>
      </View>
    </View>
  );
}

// ─── PlayerView (Sleek Minimalist Monochrome) ────────────────
interface PlayerViewProps {
  mediaData: MediaSession.MediaEvent;
  onTimeTap: () => void;
  onShare: () => void;
}

function PlayerView({ mediaData, onTimeTap, onShare }: PlayerViewProps) {
  const { width } = useWindowDimensions();
  const artworkSize = Math.min(width * 0.70, 300);

  const [displayPosition, setDisplayPosition] = useState(mediaData.position);
  const [isSeeking, setIsSeeking] = useState(false);
  const positionRef = useRef(displayPosition);

  const playerName = useMemo(() => formatPlayerName(mediaData.package), [mediaData.package]);
  const isPlaying = mediaData.state === 'playing';

  // Sync from native events
  useEffect(() => {
    if (!isSeeking) {
      setDisplayPosition(mediaData.position);
      positionRef.current = mediaData.position;
    }
  }, [mediaData.position, isSeeking]);

  // Fast ticker
  useEffect(() => {
    const interval = setInterval(() => {
      if (isSeeking || mediaData.state !== 'playing') return;
      const duration = mediaData.duration || Infinity;
      positionRef.current = Math.min(positionRef.current + 1000, duration);
      setDisplayPosition(positionRef.current);
    }, 1000);
    return () => clearInterval(interval);
  }, [isSeeking, mediaData.state, mediaData.duration]);

  const handleSeekCommit = useCallback((positionMs: number) => {
    MediaSession.seekTo(positionMs);
    positionRef.current = positionMs;
    setDisplayPosition(positionMs);
  }, []);

  const handleQuickRewind = useCallback(() => {
    const target = Math.max(0, positionRef.current - 10000);
    handleSeekCommit(target);
  }, [handleSeekCommit]);

  const handleQuickForward = useCallback(() => {
    const maxDur = mediaData.duration || Infinity;
    const target = Math.min(maxDur, positionRef.current + 10000);
    handleSeekCommit(target);
  }, [handleSeekCommit, mediaData.duration]);

  return (
    <View style={styles.playerWrapper}>
      {/* Minimalist Player Status Badge */}
      <View style={styles.badgeRow}>
        <View style={styles.monochromeBadge}>
          <View style={[styles.statusDot, isPlaying ? styles.statusDotActive : styles.statusDotPaused]} />
          <Text style={styles.badgeText}>{playerName}</Text>
          <Text style={styles.badgeDivider}>/</Text>
          <Text style={styles.badgeStateText}>{mediaData.state.toUpperCase()}</Text>
        </View>
      </View>

      {/* Album Artwork Container */}
      <View style={[styles.artworkContainer, { width: artworkSize, height: artworkSize }]}>
        {mediaData.artworkUri ? (
          <Image
            source={{ uri: mediaData.artworkUri }}
            style={styles.artwork}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.artworkPlaceholder}>
            <Icon name="music" size={40} color={COLORS.muted} />
          </View>
        )}
        <View style={styles.meterOverlay}>
          <MinimalistLevelMeter isPlaying={isPlaying} />
        </View>
      </View>

      {/* Track Metadata */}
      <View style={styles.metaInfo}>
        <View style={styles.metaRow}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.titleText} numberOfLines={1}>{mediaData.title || 'Untitled Track'}</Text>
            <Text style={styles.artistText} numberOfLines={1}>{mediaData.artist || 'Unknown Artist'}</Text>
            <Text style={styles.albumText} numberOfLines={1}>{mediaData.album || 'No Album'}</Text>
          </View>
          <TouchableOpacity onPress={onShare} style={styles.shareIconBtn} activeOpacity={0.7}>
            <Icon name="share-variant-outline" size={18} color={COLORS.secondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Progress Bar */}
      <ProgressBar
        displayPosition={displayPosition}
        duration={mediaData.duration}
        onSeekCommit={handleSeekCommit}
        onSeekStart={() => setIsSeeking(true)}
        onSeekEnd={() => setIsSeeking(false)}
        onTimeTap={onTimeTap}
      />

      {/* Controls */}
      <PlayerControls
        state={mediaData.state}
        onQuickRewind={handleQuickRewind}
        onQuickForward={handleQuickForward}
      />

      {/* Monospace Diagnostic Footprint */}
      <View style={styles.footerInner}>
        <Text style={styles.packageText} numberOfLines={1}>{mediaData.package}</Text>
        <Text style={styles.debugText}>
          {mediaData.state.toUpperCase()} • {formatTime(displayPosition)} / {formatTime(mediaData.duration)}
        </Text>
      </View>
    </View>
  );
}

// ─── Main App ────────────────────────────────────────────────
export default function App() {
  const [permission, setPermission] = useState(false);
  const [mediaData, setMediaData] = useState<MediaSession.MediaEvent | null>(null);
  const [history, setHistory] = useState<MediaSession.MediaEvent[]>([]);
  const [showSeekModal, setShowSeekModal] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const checkPermission = useCallback(() => {
    try {
      setPermission(MediaSession.hasPermission());
    } catch (_err) { /* module initializing */ }
  }, []);

  // Synchronous State Refresh (showcases getState() zero-latency queries)
  const handleSyncState = useCallback(() => {
    try {
      const state = MediaSession.getState();
      if (state) {
        setMediaData(state);
        setSyncFeedback('HYDRATED');
      } else {
        setSyncFeedback('NO SESSION');
      }
      setTimeout(() => setSyncFeedback(null), 1800);
    } catch (_err) {
      setSyncFeedback('ERROR');
      setTimeout(() => setSyncFeedback(null), 1800);
    }
  }, []);

  useEffect(() => {
    checkPermission();

    // Event Subscription
    const mediaSub = MediaSession.addMediaListener((event) => {
      setMediaData(event);
      if (event.title) {
        setHistory((prev) => {
          if (prev.length > 0 && prev[0].title === event.title && prev[0].artist === event.artist) {
            return prev;
          }
          return [event, ...prev.slice(0, 19)];
        });
      }
    });

    const appSub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        checkPermission();
        handleSyncState();
      }
    });

    return () => {
      mediaSub.remove();
      appSub.remove();
    };
  }, [checkPermission, handleSyncState]);

  const handleModalSeek = useCallback((positionMs: number) => {
    MediaSession.seekTo(positionMs);
  }, []);

  const handleShareTrack = useCallback(() => {
    if (!mediaData) return;
    const msg = `Now Playing: "${mediaData.title || 'Music'}" by ${mediaData.artist || 'Artist'}`;
    Share.share({ message: msg });
  }, [mediaData]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Sleek Minimalist Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appTitle}>MEDIA LISTENER</Text>
          <Text style={styles.appSubtitle}>V3.0.8 NATIVE MODULE</Text>
        </View>

        {/* Minimalist Action Controls */}
        <View style={styles.headerActions}>
          {/* Synchronous Hydration Trigger */}
          <TouchableOpacity
            style={[styles.headerBtn, syncFeedback ? styles.headerBtnActive : null]}
            onPress={handleSyncState}
            activeOpacity={0.7}
          >
            <Text style={styles.headerBtnText}>SYNC</Text>
          </TouchableOpacity>

          {/* Technical Inspector */}
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => setShowInspector(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.headerBtnText}>RAW</Text>
          </TouchableOpacity>

          {/* Track Log */}
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => setShowHistory(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.headerBtnText}>LOG</Text>
          </TouchableOpacity>

          {/* Status Indicator */}
          <View style={[styles.statusDotHeader, permission ? styles.statusActive : styles.statusInactive]} />
        </View>
      </View>

      {/* Sync Banner */}
      {syncFeedback && (
        <View style={styles.syncBanner}>
          <Text style={styles.syncBannerText}>getState() → {syncFeedback}</Text>
        </View>
      )}

      {/* Body Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {!permission ? (
          <PermissionCard />
        ) : mediaData ? (
          <PlayerView
            mediaData={mediaData}
            onTimeTap={() => setShowSeekModal(true)}
            onShare={handleShareTrack}
          />
        ) : (
          <IdleView onRefresh={handleSyncState} />
        )}
      </ScrollView>

      {/* Seek Modal */}
      <SeekModal
        visible={showSeekModal}
        duration={mediaData?.duration ?? 0}
        onSeek={handleModalSeek}
        onClose={() => setShowSeekModal(false)}
      />

      {/* Technical Inspector Modal */}
      <InspectorModal
        visible={showInspector}
        mediaData={mediaData}
        onClose={() => setShowInspector(false)}
      />

      {/* History Log Modal */}
      <HistoryModal
        visible={showHistory}
        history={history}
        onClose={() => setShowHistory(false)}
        onClear={() => setHistory([])}
      />
    </View>
  );
}

// ─── Styles (Strictly Monochrome, Sober, Clean, No Gamer Glows)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: RNStatusBar.currentHeight ?? 48,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  appTitle: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
  },
  appSubtitle: {
    color: COLORS.muted,
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  headerBtnActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surfaceLight,
  },
  headerBtnText: {
    color: COLORS.secondary,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
  },
  statusDotHeader: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 4,
  },
  statusActive: {
    backgroundColor: COLORS.primary,
  },
  statusInactive: {
    backgroundColor: COLORS.muted,
  },
  syncBanner: {
    backgroundColor: COLORS.surface,
    paddingVertical: 5,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  syncBannerText: {
    color: COLORS.secondary,
    fontSize: 9,
    letterSpacing: 1.5,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 24,
    justifyContent: 'center',
  },
  card: {
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    borderRadius: 4,
  },
  cardTitle: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 8,
  },
  cardDesc: {
    color: COLORS.secondary,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 16,
  },
  privacyBox: {
    backgroundColor: COLORS.surfaceLight,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.primary,
    padding: 12,
    marginBottom: 20,
    borderRadius: 2,
  },
  privacyTitle: {
    color: COLORS.primary,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  privacyDesc: {
    color: COLORS.secondary,
    fontSize: 11,
    lineHeight: 15,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 2,
  },
  primaryButtonText: {
    color: COLORS.background,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 2,
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  playerWrapper: {
    alignItems: 'center',
    width: '100%',
  },
  badgeRow: {
    marginBottom: 20,
  },
  monochromeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  statusDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginRight: 6,
  },
  statusDotActive: {
    backgroundColor: COLORS.primary,
  },
  statusDotPaused: {
    backgroundColor: COLORS.muted,
  },
  badgeText: {
    color: COLORS.primary,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  badgeDivider: {
    color: COLORS.muted,
    fontSize: 9,
    marginHorizontal: 5,
  },
  badgeStateText: {
    color: COLORS.secondary,
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 1,
  },
  artworkContainer: {
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  artwork: {
    width: '100%',
    height: '100%',
  },
  artworkPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  meterOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  meterContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 16,
    gap: 3,
  },
  meterBar: {
    width: 2,
    borderRadius: 1,
  },
  metaInfo: {
    width: '100%',
    marginBottom: 24,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  artistText: {
    color: COLORS.secondary,
    fontSize: 13,
    fontWeight: '400',
    marginBottom: 2,
  },
  albumText: {
    color: COLORS.muted,
    fontSize: 11,
  },
  shareIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    width: '100%',
    marginBottom: 24,
  },
  progressTouchArea: {
    paddingVertical: 8,
  },
  progressTrack: {
    height: 2,
    backgroundColor: COLORS.border,
    borderRadius: 1,
  },
  progressThumb: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 1,
    justifyContent: 'center',
  },
  thumbKnob: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    position: 'absolute',
    right: -4,
    top: -3,
  },
  timeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  timeValue: {
    color: COLORS.muted,
    fontSize: 10,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
  },
  timeInteractive: {
    textDecorationLine: 'underline',
    color: COLORS.secondary,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 24,
  },
  iconButton: {
    padding: 8,
  },
  discreteButton: {
    width: 36,
    height: 36,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  discreteButtonText: {
    color: COLORS.secondary,
    fontSize: 9,
    fontWeight: '700',
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  packageText: {
    color: COLORS.muted,
    fontSize: 9,
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    marginBottom: 2,
  },
  idleView: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  idleMessage: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 6,
  },
  idleSubMessage: {
    color: COLORS.secondary,
    fontSize: 11,
    marginBottom: 2,
  },
  idleHint: {
    color: COLORS.muted,
    fontSize: 10,
    marginBottom: 24,
  },
  footerInner: {
    marginTop: 6,
    alignItems: 'center',
  },
  debugText: {
    color: COLORS.muted,
    fontSize: 9,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    textAlign: 'center',
    letterSpacing: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    borderRadius: 4,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  closeBtn: {
    padding: 4,
  },
  modalSubtitle: {
    color: COLORS.muted,
    fontSize: 10,
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: COLORS.background,
    color: COLORS.primary,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    borderRadius: 2,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  modalSecondaryBtn: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    borderRadius: 2,
    backgroundColor: COLORS.surface,
  },
  modalPrimaryBtn: {
    flex: 1,
    padding: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    borderRadius: 2,
  },
  modalSecondaryText: {
    color: COLORS.secondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  modalPrimaryText: {
    color: COLORS.background,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  techScroll: {
    marginVertical: 8,
  },
  techTable: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 2,
  },
  techRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  techKey: {
    color: COLORS.muted,
    fontSize: 9,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    fontWeight: '700',
    letterSpacing: 1,
    width: '32%',
  },
  techVal: {
    color: COLORS.primary,
    fontSize: 10,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    flex: 1,
    textAlign: 'right',
  },
  techValHighlight: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    flex: 1,
    textAlign: 'right',
  },
  techValMono: {
    color: COLORS.secondary,
    fontSize: 10,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    flex: 1,
    textAlign: 'right',
  },
  techValMonoSmall: {
    color: COLORS.muted,
    fontSize: 9,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    flex: 1,
    textAlign: 'right',
  },
  emptyText: {
    color: COLORS.muted,
    fontSize: 11,
    textAlign: 'center',
    marginVertical: 20,
    letterSpacing: 1.5,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
  },
  logItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  logIndex: {
    width: 24,
    marginRight: 10,
  },
  logIndexText: {
    color: COLORS.muted,
    fontSize: 10,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
  },
  logContent: {
    flex: 1,
  },
  logTitle: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  logArtist: {
    color: COLORS.secondary,
    fontSize: 10,
    marginTop: 2,
  },
  logTime: {
    color: COLORS.muted,
    fontSize: 9,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    marginLeft: 8,
  },
});
