import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, Image, StatusBar,
  PanResponder, Modal, TextInput, KeyboardAvoidingView, Platform,
  useWindowDimensions, AppState, AppStateStatus
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as MediaSession from './modules/media-session';

// ─── Color Palette ───────────────────────────────────────────
const COLORS = {
  background: '#000000',
  surface: '#0A0A0A',
  border: '#222222',
  primary: '#FFFFFF',
  secondary: '#777777',
  muted: '#444444',
  error: '#FF4444',
  success: '#FFFFFF',
};

// ─── Helpers ─────────────────────────────────────────────────
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

// ─── PermissionCard ──────────────────────────────────────────
function PermissionCard() {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>PERMISSION REQUIRED</Text>
      <Text style={styles.cardDesc}>
        Notification access is needed to listen for media events.
      </Text>
      <TouchableOpacity style={styles.primaryButton} onPress={() => MediaSession.requestPermission()}>
        <Text style={styles.primaryButtonText}>GRANT PERMISSION</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── IdleView ────────────────────────────────────────────────
function IdleView() {
  return (
    <View style={styles.idleView}>
      <Text style={styles.idleMessage}>READY FOR PLAYBACK</Text>
      <Text style={styles.idleSubMessage}>No active media session detected</Text>
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
        seconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
      } else if (parts.length === 2) {
        seconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
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
          <Text style={styles.modalTitle}>JUMP TO TIME</Text>
          <Text style={styles.modalSubtitle}>Format: MM:SS or Seconds</Text>
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
            <TouchableOpacity style={styles.modalButtonSecondary} onPress={onClose}>
              <Text style={styles.modalButtonTextSecondary}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalButtonPrimary} onPress={handleSubmit}>
              <Text style={styles.modalButtonTextPrimary}>GO</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── PlayerControls ──────────────────────────────────────────
interface PlayerControlsProps {
  state: string;
}

function PlayerControls({ state }: PlayerControlsProps) {
  return (
    <View style={styles.controls}>
      <TouchableOpacity onPress={() => MediaSession.skipPrevious()} style={styles.iconButton}>
        <Feather name="skip-back" size={28} color={COLORS.secondary} />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => state === 'playing' ? MediaSession.pause() : MediaSession.play()}
        style={styles.playButton}
      >
        <Feather
          name={state === 'playing' ? 'pause' : 'play'}
          size={32}
          color={COLORS.background} 
        />
      </TouchableOpacity>

      <TouchableOpacity onPress={() => MediaSession.skipNext()} style={styles.iconButton}>
        <Feather name="skip-forward" size={28} color={COLORS.secondary} />
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
  const trackRef = useRef<View>(null);
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
      trackRef.current?.measure((_x, _y, w, _h, pageX) => {
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
            trackRef.current?.measure((_x, _y, w, _h, pageX) => {
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
        <TouchableOpacity onPress={onTimeTap}>
          <Text style={[styles.timeValue, styles.timeInteractive]}>{formatTime(localPosition)}</Text>
        </TouchableOpacity>
        <Text style={styles.timeValue}>{formatTime(duration)}</Text>
      </View>
    </View>
  );
}

// ─── PlayerView ──────────────────────────────────────────────
interface PlayerViewProps {
  mediaData: MediaSession.MediaEvent;
  onTimeTap: () => void;
}

function PlayerView({ mediaData, onTimeTap }: PlayerViewProps) {
  const { width } = useWindowDimensions();
  const artworkSize = width * 0.7;

  const [displayPosition, setDisplayPosition] = useState(mediaData.position);
  const [isSeeking, setIsSeeking] = useState(false);
  const positionRef = useRef(displayPosition);

  // Sync from native events
  useEffect(() => {
    if (!isSeeking) {
      setDisplayPosition(mediaData.position);
      positionRef.current = mediaData.position;
    }
  }, [mediaData.position, isSeeking]);

  // Fast-updating ticker
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

  return (
    <View style={styles.playerWrapper}>
      {/* Artwork */}
      <View style={[styles.artworkContainer, { width: artworkSize, height: artworkSize }]}>
        {mediaData.artworkUri ? (
          <Image
            source={{ uri: mediaData.artworkUri }}
            style={styles.artwork}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.artworkPlaceholder}>
            <Feather name="music" size={40} color={COLORS.muted} />
          </View>
        )}
      </View>

      {/* Metadata */}
      <View style={styles.metaInfo}>
        <Text style={styles.titleText} numberOfLines={1}>{mediaData.title || 'No Title'}</Text>
        <Text style={styles.artistText} numberOfLines={1}>{mediaData.artist || 'Unknown Artist'}</Text>
        <Text style={styles.albumText} numberOfLines={1}>{mediaData.album || 'No Album'}</Text>
      </View>

      {/* Progress */}
      <ProgressBar
        displayPosition={displayPosition}
        duration={mediaData.duration}
        onSeekCommit={handleSeekCommit}
        onSeekStart={() => setIsSeeking(true)}
        onSeekEnd={() => setIsSeeking(false)}
        onTimeTap={onTimeTap}
      />

      {/* Controls */}
      <PlayerControls state={mediaData.state} />

      <Text style={styles.packageText}>{mediaData.package}</Text>

      {/* Footer / Debug */}
      <View style={styles.footerInner}>
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
  const [showSeekModal, setShowSeekModal] = useState(false);

  const checkPermission = useCallback(() => {
    try {
      setPermission(MediaSession.hasPermission());
    } catch (_err) { /* module not ready */ }
  }, []);

  useEffect(() => {
    checkPermission();

    const mediaSub = MediaSession.addMediaListener((event) => {
      setMediaData(event);
    });

    const appSub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') checkPermission();
    });

    return () => {
      mediaSub.remove();
      appSub.remove();
    };
  }, [checkPermission]);

  const handleModalSeek = useCallback((positionMs: number) => {
    MediaSession.seekTo(positionMs);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.appTitle}>MEDIA SESSION</Text>
        <View style={[styles.statusIndicator, permission ? styles.statusActive : styles.statusInactive]} />
      </View>

      <View style={styles.mainContent}>
        {!permission ? (
          <PermissionCard />
        ) : mediaData ? (
          <PlayerView
            mediaData={mediaData}
            onTimeTap={() => setShowSeekModal(true)}
          />
        ) : (
          <IdleView />
        )}
      </View>

      {/* Seek Modal */}
      <SeekModal
        visible={showSeekModal}
        duration={mediaData?.duration ?? 0}
        onSeek={handleModalSeek}
        onClose={() => setShowSeekModal(false)}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: StatusBar.currentHeight ?? 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 30,
    marginBottom: 40,
  },
  appTitle: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '300',
    letterSpacing: 4,
  },
  statusIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusActive: {
    backgroundColor: COLORS.primary,
  },
  statusInactive: {
    backgroundColor: COLORS.muted,
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 30,
    justifyContent: 'center',
  },
  card: {
    padding: 30,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
  },
  cardTitle: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 10,
  },
  cardDesc: {
    color: COLORS.secondary,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 30,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 4,
  },
  primaryButtonText: {
    color: COLORS.background,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  playerWrapper: {
    alignItems: 'center',
    width: '100%',
  },
  artworkContainer: {
    marginBottom: 40,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    overflow: 'hidden',
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
  metaInfo: {
    width: '100%',
    marginBottom: 30,
  },
  titleText: {
    color: COLORS.primary,
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  artistText: {
    color: COLORS.secondary,
    fontSize: 14,
    marginBottom: 2,
  },
  albumText: {
    color: COLORS.muted,
    fontSize: 12,
  },
  progressContainer: {
    width: '100%',
    marginBottom: 30,
  },
  progressTouchArea: {
    paddingVertical: 10,
  },
  progressTrack: {
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
  },
  progressThumb: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 2,
    justifyContent: 'center',
  },
  thumbKnob: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
    position: 'absolute',
    right: -6,
    top: -4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 1.41,
    elevation: 2,
  },
  timeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  timeValue: {
    color: COLORS.muted,
    fontSize: 10,
    fontFamily: 'monospace',
  },
  timeInteractive: {
    textDecorationLine: 'underline',
    color: COLORS.primary,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 50,
    marginBottom: 30,
  },
  iconButton: {
    padding: 10,
  },
  playButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  packageText: {
    color: COLORS.muted,
    fontSize: 9,
    letterSpacing: 1,
  },
  idleView: {
    alignItems: 'center',
  },
  idleMessage: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '300',
    letterSpacing: 3,
    marginBottom: 8,
  },
  idleSubMessage: {
    color: COLORS.muted,
    fontSize: 11,
  },
  footerInner: {
    marginTop: 30,
    padding: 10,
  },
  debugText: {
    color: COLORS.muted,
    fontSize: 9,
    fontFamily: 'monospace',
    textAlign: 'center',
    letterSpacing: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  modalContent: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 30,
    borderRadius: 8,
  },
  modalTitle: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 5,
    textAlign: 'center',
  },
  modalSubtitle: {
    color: COLORS.secondary,
    fontSize: 11,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: COLORS.background,
    color: COLORS.primary,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 15,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: 'monospace',
    borderRadius: 4,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalButtonSecondary: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    borderRadius: 4,
  },
  modalButtonPrimary: {
    flex: 1,
    padding: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    borderRadius: 4,
  },
  modalButtonTextSecondary: {
    color: COLORS.secondary,
    fontSize: 11,
    fontWeight: '600',
  },
  modalButtonTextPrimary: {
    color: COLORS.background,
    fontSize: 11,
    fontWeight: '800',
  },
});
