import { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, AppState, Image, StatusBar, Dimensions, PanResponder, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import * as MediaSession from './modules/media-session';

const { width } = Dimensions.get('window');

// Sober Color Palette
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

export default function App() {
  const [permission, setPermission] = useState(false);
  const [mediaData, setMediaData] = useState<MediaSession.MediaEvent | null>(null);
  const [status, setStatus] = useState('Initializing...');
  const positionRef = useRef(0);
  const [displayPosition, setDisplayPosition] = useState(0);
  const [trackWidth, setTrackWidth] = useState(0);
  
  // Seeking State
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekToTime, setSeekToTime] = useState('');
  const [showSeekModal, setShowSeekModal] = useState(false);

  // PanResponder for drag seeking
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setIsSeeking(true);
      },
      onPanResponderMove: (evt, gestureState) => {
        if (!trackWidth || !mediaData?.duration) return;
        const locationX = Math.max(0, Math.min(gestureState.moveX - 30, trackWidth)); // 30 is paddingHorizontal
        const percentage = locationX / trackWidth;
        const newPosition = Math.floor(percentage * mediaData.duration);
        setDisplayPosition(newPosition);
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (!trackWidth || !mediaData?.duration) {
          setIsSeeking(false);
          return;
        }
        const locationX = Math.max(0, Math.min(gestureState.moveX - 30, trackWidth));
        const percentage = locationX / trackWidth;
        const newPosition = Math.floor(percentage * mediaData.duration);
        
        MediaSession.seekTo(newPosition);
        positionRef.current = newPosition;
        setTimeout(() => setIsSeeking(false), 500); // Delay to prevent jump back
      },
    })
  ).current;

  // Manual Seek Handler
  const handleManualSeek = () => {
    if (!seekToTime || !mediaData?.duration) return;
    
    // Parse time string (e.g., "1:30", "90", "1.5")
    let seconds = 0;
    if (seekToTime.includes(':')) {
      const parts = seekToTime.split(':');
      if (parts.length === 2) {
        seconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
      }
    } else {
      seconds = parseFloat(seekToTime);
    }
    
    if (!isNaN(seconds)) {
      const ms = seconds * 1000; // Convert to ms if user entered seconds, typically seek inputs are in seconds or min:sec
      // Note: If user enters raw ms, that's rare. Let's assume input is seconds or MM:SS
      // Actually, if someone enters "1000", do they mean 1000s or 1000ms? 
      // Music apps usually deal in seconds. Let's standardise on seconds.
      // But wait, our internal logic uses MS.
      
      const targetPos = Math.min(Math.max(0, ms), mediaData.duration);
      MediaSession.seekTo(targetPos);
      positionRef.current = targetPos;
      setDisplayPosition(targetPos);
    }
    
    setShowSeekModal(false);
    setSeekToTime('');
  };

  const handleSeekPress = (evt: any) => {
      // Fallback for simple tap if PanResponder doesn't catch it (though it should)
      // Actually PanResponder on the container might block simple onPress on children?
      // We'll attach PanResponder to a view wrapping the track.
      if (!mediaData?.duration || !trackWidth) return;

      const locationX = evt.nativeEvent.locationX;
      const percentage = Math.max(0, Math.min(1, locationX / trackWidth));
      const newPosition = Math.floor(percentage * mediaData.duration);

      setDisplayPosition(newPosition);
      positionRef.current = newPosition;
      MediaSession.seekTo(newPosition);
  };

  const checkPermission = () => {
    try {
      setPermission(MediaSession.hasPermission());
      setStatus('System Ready');
    } catch (err: any) {
      setStatus(`System Error: ${err.message}`);
    }
  };

  useEffect(() => {
    checkPermission();

    const mediaSub = MediaSession.addMediaListener((event) => {
      setMediaData(event);
      if (!isSeeking) {
          positionRef.current = event.position;
      }
    });

    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkPermission();
    });

    const positionInterval = setInterval(() => {
      if (isSeeking) return; // Don't fight the user

      if (mediaData?.state === 'playing') {
        positionRef.current += 1000;
        setDisplayPosition(positionRef.current);
      } else if (mediaData) {
        // Correct position drift when paused/updating
        if (Math.abs(displayPosition - mediaData.position) > 2000) {
             setDisplayPosition(mediaData.position);
        }
      }
    }, 1000);

    return () => {
      mediaSub.remove();
      appSub.remove();
      clearInterval(positionInterval);
    };
  }, [mediaData?.state, mediaData?.position, isSeeking]);

  const formatTime = (ms: number) => {
    if (!ms || ms < 0) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progressPercent = mediaData?.duration
    ? Math.min((displayPosition / mediaData.duration) * 100, 100)
    : 0;

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
          <View style={styles.card}>
            <Text style={styles.cardTitle}>PERMISSION REQUIRED</Text>
            <Text style={styles.cardDesc}>
              Notification access is needed to listen for media events.
            </Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => MediaSession.requestPermission()}>
              <Text style={styles.primaryButtonText}>GRANT PERMISSION</Text>
            </TouchableOpacity>
          </View>
        ) : mediaData ? (
          <View style={styles.playerWrapper}>
            {/* Artwork */}
            <View style={styles.artworkContainer}>
              {mediaData.artworkUri ? (
                <Image
                  source={{ uri: mediaData.artworkUri }}
                  style={styles.artwork}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.artworkPlaceholder}>
                  <Text style={styles.placeholderIcon}>♪</Text>
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
            <View style={styles.progressContainer}>
              <View
                {...panResponder.panHandlers}
                style={styles.progressTouchArea}
              >
                <View
                  style={styles.progressTrack}
                  onLayout={(e: any) => setTrackWidth(e.nativeEvent.layout.width)}
                >
                  <View style={[styles.progressThumb, { width: `${progressPercent}%` }]} />
                </View>
              </View>
              <View style={styles.timeLabels}>
                <TouchableOpacity onPress={() => setShowSeekModal(true)}>
                    <Text style={[styles.timeValue, styles.timeInteractive]}>{formatTime(displayPosition)}</Text>
                </TouchableOpacity>
                <Text style={styles.timeValue}>{formatTime(mediaData.duration)}</Text>
              </View>
            </View>

            {/* Controls */}
            <View style={styles.controls}>
              <TouchableOpacity onPress={() => MediaSession.skipPrevious()} style={styles.iconButton}>
                <Text style={styles.iconText}>⏮</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => mediaData.state === 'playing' ? MediaSession.pause() : MediaSession.play()}
                style={styles.playButton}
              >
                <Text style={styles.playIconText}>
                  {mediaData.state === 'playing' ? '⏸' : '▶'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => MediaSession.skipNext()} style={styles.iconButton}>
                <Text style={styles.iconText}>⏭</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.packageText}>{mediaData.package}</Text>
          </View>
        ) : (
          <View style={styles.idleView}>
            <Text style={styles.idleMessage}>READY FOR PLAYBACK</Text>
            <Text style={styles.idleSubMessage}>No active media session detected</Text>
          </View>
        )}
      </View>

      {/* Footer / Debug */}
      {mediaData && (
        <View style={styles.footer}>
          <Text style={styles.debugText}>
            {mediaData.state.toUpperCase()} • {formatTime(displayPosition)} / {formatTime(mediaData.duration)}
          </Text>
        </View>
      )}

      {/* Manual Seek Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showSeekModal}
        onRequestClose={() => setShowSeekModal(false)}
      >
        <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : "height"}
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
                onSubmitEditing={handleManualSeek}
            />
            
            <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalButtonSecondary} onPress={() => setShowSeekModal(false)}>
                    <Text style={styles.modalButtonTextSecondary}>CANCEL</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalButtonPrimary} onPress={handleManualSeek}>
                    <Text style={styles.modalButtonTextPrimary}>GO</Text>
                </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: 60,
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
    borderRadius: 2,
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
    borderRadius: 2,
  },
  primaryButtonText: {
    color: COLORS.background,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  playerWrapper: {
    alignItems: 'center',
  },
  artworkContainer: {
    width: width * 0.7,
    aspectRatio: 1,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
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
  placeholderIcon: {
    color: COLORS.muted,
    fontSize: 40,
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
  },
  timeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  iconText: {
    color: COLORS.secondary,
    fontSize: 20,
  },
  playButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIconText: {
    color: COLORS.primary,
    fontSize: 24,
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
  footer: {
    padding: 30,
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
  },
  modalButtonPrimary: {
      flex: 1,
      padding: 12,
      backgroundColor: COLORS.primary,
      alignItems: 'center',
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

