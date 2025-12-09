import { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, AppState } from 'react-native';
import * as MediaSession from './modules/media-session';

export default function App() {
  const [permission, setPermission] = useState(false);
  const [mediaData, setMediaData] = useState<MediaSession.MediaEvent | null>(null);
  const [status, setStatus] = useState('Loading...');
  const positionRef = useRef(0);
  const [displayPosition, setDisplayPosition] = useState(0);

  const checkPermission = () => {
    try {
      setPermission(MediaSession.hasPermission());
      setStatus('Ready');
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    }
  };

  useEffect(() => {
    checkPermission();

    const mediaSub = MediaSession.addMediaListener((event) => {
      setMediaData(event);
      positionRef.current = event.position;
    });

    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkPermission();
    });

    const positionInterval = setInterval(() => {
      if (mediaData?.state === 'playing') {
        positionRef.current += 1000;
        setDisplayPosition(positionRef.current);
      }
    }, 1000);

    return () => {
      mediaSub.remove();
      appSub.remove();
      clearInterval(positionInterval);
    };
  }, [mediaData?.state]);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = mediaData?.duration ? (displayPosition / mediaData.duration) * 100 : 0;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>🎵 Media Session</Text>
      <Text style={styles.subtitle}>MediaSessionManager API</Text>

      <View style={styles.statusBox}>
        <Text style={styles.label}>Status</Text>
        <Text style={[styles.value, status.includes('Error') && styles.error]}>
          {status}
        </Text>
      </View>

      <View style={styles.permissionBox}>
        <Text style={styles.permissionText}>
          {permission ? '✅ Permission Granted' : '❌ Permission Required'}
        </Text>
        {!permission && (
          <TouchableOpacity style={styles.button} onPress={() => MediaSession.requestPermission()}>
            <Text style={styles.buttonText}>Grant Permission</Text>
          </TouchableOpacity>
        )}
      </View>

      {permission && (
        <View style={styles.content}>
          <Text style={styles.section}>Now Playing</Text>
          {mediaData ? (
            <View style={styles.card}>
              <View style={styles.stateIndicator}>
                <View style={[styles.stateDot, mediaData.state === 'playing' && styles.statePlaying]} />
                <Text style={styles.stateText}>{mediaData.state.toUpperCase()}</Text>
              </View>
              <Text style={styles.title}>{mediaData.title || 'Unknown'}</Text>
              <Text style={styles.artist}>{mediaData.artist || 'Unknown'}</Text>
              <Text style={styles.album}>{mediaData.album || ''}</Text>

              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${Math.min(progress, 100)}%` }]} />
                </View>
                <View style={styles.timeRow}>
                  <Text style={styles.time}>{formatTime(displayPosition)}</Text>
                  <Text style={styles.time}>{formatTime(mediaData.duration)}</Text>
                </View>
              </View>

              <View style={styles.controls}>
                <TouchableOpacity style={styles.controlBtn} onPress={() => MediaSession.skipPrevious()}>
                  <Text style={styles.controlIcon}>⏮</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.controlBtn, styles.playBtn]}
                  onPress={() => mediaData.state === 'playing' ? MediaSession.pause() : MediaSession.play()}
                >
                  <Text style={styles.playIcon}>{mediaData.state === 'playing' ? '⏸' : '▶'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.controlBtn} onPress={() => MediaSession.skipNext()}>
                  <Text style={styles.controlIcon}>⏭</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.source}>{mediaData.package}</Text>
            </View>
          ) : (
            <Text style={styles.empty}>Play some music...</Text>
          )}

          <Text style={styles.section}>Debug</Text>
          <ScrollView style={styles.debug}>
            <Text style={styles.json}>
              {JSON.stringify(mediaData, null, 2) || 'null'}
            </Text>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  header: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: '#8b5cf6',
    textAlign: 'center',
    marginBottom: 20,
  },
  statusBox: {
    backgroundColor: '#151520',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  label: {
    color: '#666',
    fontSize: 12,
    marginBottom: 4,
  },
  value: {
    color: '#4ade80',
    fontSize: 15,
    fontWeight: '600',
  },
  error: {
    color: '#f87171',
  },
  permissionBox: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  permissionText: {
    color: '#ccc',
    fontSize: 15,
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  card: {
    backgroundColor: '#1e1e28',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  stateIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#666',
    marginRight: 6,
  },
  statePlaying: {
    backgroundColor: '#4ade80',
  },
  stateText: {
    color: '#888',
    fontSize: 11,
    letterSpacing: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  artist: {
    fontSize: 15,
    color: '#aaa',
    marginTop: 4,
  },
  album: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  progressContainer: {
    width: '100%',
    marginTop: 16,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#8b5cf6',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  time: {
    color: '#666',
    fontSize: 11,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 20,
  },
  controlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2a2a35',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#8b5cf6',
  },
  controlIcon: {
    fontSize: 18,
    color: '#fff',
  },
  playIcon: {
    fontSize: 24,
    color: '#fff',
  },
  source: {
    fontSize: 11,
    color: '#444',
    marginTop: 12,
  },
  empty: {
    color: '#555',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
  debug: {
    flex: 1,
    backgroundColor: '#000',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  json: {
    color: '#22c55e',
    fontFamily: 'monospace',
    fontSize: 11,
  },
});
