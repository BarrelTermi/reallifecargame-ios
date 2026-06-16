import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions } from 'react-native';
import * as Location from 'expo-location';
import { DeviceMotion } from 'expo-sensors';

const SCREEN_WIDTH = Dimensions.get('window').width;
const LANE_WIDTH = 100; // The pixel distance the car slides left or right

export default function App() {
  // --- Game Engine Loops & States ---
  const [currentState, setCurrentState] = useState('WAITING_FOR_TRAFFIC');
  const [speedKmH, setSpeedKmH] = useState(0);
  const [coords, setCoords] = useState({ lat: 0, lon: 0 });
  const [speedSamples, setSpeedSamples] = useState([]);
  
  // --- Car Handling Variables ---
  const [carXPosition, setCarXPosition] = useState(0); // Center lane is 0
  const carZDistance = useRef(0); // Tracks your total forward distance driven

  // MARK: - 1. CONNECT TO IPHONE GPS & SPEEDOMETER
  useEffect(() => {
    (async () => {
      // Pops up the official Apple privacy message asking for location access
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('GPS Access Denied! The game engine cannot calculate real-life speed.');
        return;
      }

      // Watches your movement continuously in real-time
      await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000, // Update speed every single second
          distanceInterval: 1, // Update if you move even 1 meter
        },
        (location) => {
          const rawSpeed = location.coords.speed; // meters per second from iPhone hardware
          const currentSpeed = rawSpeed > 0 ? Math.round(rawSpeed * 3.6) : 0; // Convert to km/h
          
          setSpeedKmH(currentSpeed);
          setCoords({
            lat: location.coords.latitude,
            lon: location.coords.longitude,
          });

          // Save speed points into an array to look for traffic patterns
          setSpeedSamples((prev) => [...prev, currentSpeed]);
        }
      );
    })();
  }, []);

  // MARK: - 2. AUTOMATIC TRAFFIC FILTER (AUTO-START)
  useEffect(() => {
    const trafficInterval = setInterval(() => {
      if (speedSamples.length === 0) return;

      // Take the average speed over the last 10 seconds
      const sum = speedSamples.reduce((a, b) => a + b, 0);
      const avgSpeed = sum / speedSamples.length;
      setSpeedSamples([]); // Clear cache array for the next 10 seconds

      if (currentState === 'WAITING_FOR_TRAFFIC') {
        // If speed signals reflect stop-and-go pattern (bouncing between 2 and 25 km/h), start the game!
        if (avgSpeed > 2 && avgSpeed <= 25) {
          setCurrentState('PLAYING');
        }
      }
    }, 10000);

    return () => clearInterval(trafficInterval);
  }, [speedSamples, currentState]);

  // MARK: - 3. PHONE WHEEL STEERING (GYROSCOPE / MOTION)
  useEffect(() => {
    if (currentState === 'PLAYING') {
      DeviceMotion.setUpdateInterval(16); // Check phone tilt at 60 frames per second
      const subscription = DeviceMotion.addListener((data) => {
        if (data.rotation) {
          // Gamma tracks side-to-side device rotation (holding phone like a steering wheel)
          const tiltAngle = data.rotation.gamma;

          if (tiltAngle > 0.4) {
            setCarXPosition(-LANE_WIDTH); // Slide Left Lane
          } else if (tiltAngle < -0.4) {
            setCarXPosition(LANE_WIDTH);  // Slide Right Lane
          } else {
            setCarXPosition(0);           // Stay in Center Lane
          }
        }
      });
      return () => subscription.remove();
    }
  }, [currentState]);

  // MARK: - 4. FORWARD SPEED MATCH ENGINE
  useEffect(() => {
    let gameLoop;
    if (currentState === 'PLAYING') {
      gameLoop = setInterval(() => {
        // Multiplies actual car speed by frame timing to move your virtual car forward
        const speedFactor = (speedKmH / 3.6) * 0.1;
        carZDistance.current += speedFactor;
      }, 16); // Run logic every frame
    }
    return () => clearInterval(gameLoop);
  }, [currentState, speedKmH]);

  // MARK: - 5. DYNAMIC RESTART RESPAWNER (DUBAI/SHARJAH TELEPORT)
  const resetToCurrentCoordinates = () => {
    // Wipes old distance matrix and samples your brand new physical coordinates instantly
    console.log(`Wiping old tracks. Respawning game anchor coordinates at: ${coords.lat}, ${coords.lon}`);
    carZDistance.current = 0;
    setCurrentState('PLAYING');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>REAL-LIFE CAR SIMULATOR</Text>
      
      {/* HUD Heads-up Display Dashboard */}
      <View style={styles.dashboard}>
        <Text style={styles.dashText}>SPEED MATCH: {speedKmH} km/h</Text>
        <Text style={styles.coordsText}>LAT: {coords.lat.toFixed(4)} | LON: {coords.lon.toFixed(4)}</Text>
        <Text style={styles.statusText}>STATUS: {currentState.replace(/_/g, ' ')}</Text>
      </View>

      {/* Visual Road Viewport */}
      {currentState === 'PLAYING' && (
        <View style={styles.road}>
          <View style={styles.laneDividerLeft} />
          <View style={styles.laneDividerRight} />
          
          {/* Your Player Car */}
          <View style={[styles.car, { transform: [{ translateX: carXPosition }] }]}>
            <Text style={styles.carText}>🚗</Text>
          </View>
        </View>
      )}

      {/* Manual Crash Trigger (So you can test the Restart button without actually crashing!) */}
      {currentState === 'PLAYING' && (
        <TouchableOpacity style={styles.crashBtn} onPress={() => setCurrentState('CRASHED')}>
          <Text style={styles.btnText}>💥 TRIGGER FAKE CRASH</Text>
        </TouchableOpacity>
      )}

      {/* Teleport Restart Button Handler */}
      {currentState === 'CRASHED' && (
        <TouchableOpacity style={styles.restartBtn} onPress={resetToCurrentCoordinates}>
          <Text style={styles.btnText}>🔄 RESTART AT CURRENT PHYSICAL LOCATION</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// MARK: - 6. VISUAL APPS SKINS (UI DESIGN)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111625', alignItems: 'center', justifyContent: 'center', padding: 20 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#FFD700', marginBottom: 20, letterSpacing: 1 },
  dashboard: { backgroundColor: '#1A1F2C', padding: 15, borderRadius: 12, width: '100%', marginBottom: 30, borderWidth: 1, borderColor: '#313A52' },
  dashText: { color: '#00FF66', fontSize: 22, fontWeight: 'bold', textAlign: 'center' },
  coordsText: { color: '#8E9AEC', fontSize: 13, fontFamily: 'monospace', textAlign: 'center', marginTop: 6 },
  statusText: { color: '#FFFFFF', fontSize: 15, textAlign: 'center', marginTop: 10, fontWeight: '600', textTransform: 'uppercase' },
  road: { width: SCREEN_WIDTH - 40, height: 320, backgroundColor: '#23272A', borderRadius: 24, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 40, borderWidth: 3, borderColor: '#444', overflow: 'hidden', position: 'relative' },
  laneDividerLeft: { position: 'absolute', left: '33%', top: 0, bottom: 0, width: 2, borderStyle: 'dashed', borderColor: '#FFF', borderWidth: 1 },
  laneDividerRight: { position: 'absolute', right: '33%', top: 0, bottom: 0, width: 2, borderStyle: 'dashed', borderColor: '#FFF', borderWidth: 1 },
  car: { width: 65, height: 65, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  carText: { fontSize: 45 },
  crashBtn: { backgroundColor: '#D9383A', padding: 14, borderRadius: 10, marginTop: 20, width: '100%' },
  restartBtn: { backgroundColor: '#28A745', padding: 18, borderRadius: 12, marginTop: 20, width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5 },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16, textAlign: 'center' }
});
