import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, PresentationControls } from '@react-three/drei';

function AI_Brain() {
  const ref = useRef();
  useFrame((state, delta) => {
    ref.current.rotation.y += delta * 0.8;
    ref.current.rotation.x += delta * 0.4;
  });
  return (
    <group ref={ref}>
      <mesh>
        <icosahedronGeometry args={[1.2, 1]} />
        <meshStandardMaterial color="#FF7A59" wireframe={true} />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[0.8, 0]} />
        <meshStandardMaterial color="#FF7A59" roughness={0.2} />
      </mesh>
    </group>
  );
}

function FEFO_Boxes() {
  const ref = useRef();
  useFrame((state, delta) => {
    ref.current.rotation.y += delta * 0.5;
  });
  return (
    <group ref={ref} position={[0, -0.5, 0]}>
      {/* Bottom box */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[1.5, 0.4, 1.5]} />
        <meshStandardMaterial color="#E8F5F1" />
      </mesh>
      {/* Middle box */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[1.5, 0.4, 1.5]} />
        <meshStandardMaterial color="#E8F5F1" />
      </mesh>
      {/* Top box (expiring soonest) */}
      <mesh position={[0, 1.0, 0]}>
        <boxGeometry args={[1.5, 0.4, 1.5]} />
        <meshStandardMaterial color="#0F6E6A" />
      </mesh>
    </group>
  );
}

function Auto_Arrow() {
  const ref = useRef();
  useFrame((state, delta) => {
    ref.current.rotation.z += delta * 1;
    ref.current.rotation.y += delta * 0.5;
  });
  return (
    <group ref={ref}>
      {/* Arrow body */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 1.5, 16]} />
        <meshStandardMaterial color="#FF7A59" />
      </mesh>
      {/* Arrow head */}
      <mesh position={[0, 1.2, 0]}>
        <coneGeometry args={[0.6, 1, 16]} />
        <meshStandardMaterial color="#FF7A59" />
      </mesh>
    </group>
  );
}

function BarChart() {
  const ref = useRef();
  useFrame((state, delta) => {
    ref.current.rotation.y -= delta * 0.4;
  });
  return (
    <group ref={ref} position={[0, -0.8, 0]}>
      <mesh position={[-0.8, 0.6, 0]}>
        <boxGeometry args={[0.5, 1.2, 0.5]} />
        <meshStandardMaterial color="#0F6E6A" />
      </mesh>
      <mesh position={[0, 1.0, 0]}>
        <boxGeometry args={[0.5, 2.0, 0.5]} />
        <meshStandardMaterial color="#FF7A59" />
      </mesh>
      <mesh position={[0.8, 0.4, 0]}>
        <boxGeometry args={[0.5, 0.8, 0.5]} />
        <meshStandardMaterial color="#E8F5F1" />
      </mesh>
    </group>
  );
}

// Wrapper to render these small scenes
export function FeatureIcon3D({ type }) {
  return (
    <div style={{ width: '80px', height: '80px', margin: '0 0 1.5rem 0', cursor: 'grab' }}>
      <Canvas camera={{ position: [0, 0, 4], fov: 50 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <PresentationControls global rotation={[0.2, 0, 0]}>
          <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
            {type === 'ai' && <AI_Brain />}
            {type === 'fefo' && <FEFO_Boxes />}
            {type === 'auto' && <Auto_Arrow />}
            {type === 'chart' && <BarChart />}
          </Float>
        </PresentationControls>
      </Canvas>
    </div>
  );
}
