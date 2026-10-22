import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, ContactShadows, Float, PresentationControls } from '@react-three/drei';

function Capsule() {
  const capsuleRef = useRef();

  useFrame((state, delta) => {
    capsuleRef.current.rotation.y += delta * 0.5;
    capsuleRef.current.rotation.x += delta * 0.2;
  });

  return (
    <group ref={capsuleRef}>
      {/* Top half of the capsule */}
      <mesh position={[0, 0.75, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 1.5, 32]} />
        <meshStandardMaterial color="#0F6E6A" roughness={0.1} metalness={0.1} />
      </mesh>
      <mesh position={[0, 1.5, 0]}>
        <sphereGeometry args={[0.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#0F6E6A" roughness={0.1} metalness={0.1} />
      </mesh>

      {/* Bottom half of the capsule */}
      <mesh position={[0, -0.75, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 1.5, 32]} />
        <meshStandardMaterial color="#E8F5F1" roughness={0.1} metalness={0.1} />
      </mesh>
      <mesh position={[0, -1.5, 0]} rotation={[Math.PI, 0, 0]}>
        <sphereGeometry args={[0.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#E8F5F1" roughness={0.1} metalness={0.1} />
      </mesh>
    </group>
  );
}

export default function ThreeScene() {
  return (
    <div className="three-scene-container">
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        
        <PresentationControls
          global
          config={{ mass: 2, tension: 500 }}
          snap={{ mass: 4, tension: 1500 }}
          rotation={[0, 0.3, 0]}
          polar={[-Math.PI / 3, Math.PI / 3]}
          azimuth={[-Math.PI / 1.4, Math.PI / 2]}
        >
          <Float
            speed={2} 
            rotationIntensity={1} 
            floatIntensity={2}
          >
            <Capsule />
          </Float>
        </PresentationControls>

        <ContactShadows position={[0, -2.5, 0]} opacity={0.4} scale={10} blur={2} far={4} />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
}
