
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { IFCLoader } from 'web-ifc-three/IFCLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

interface SimpleIFCViewerProps {
    fileUrl: string;
}

export const SimpleIFCViewer: React.FC<SimpleIFCViewerProps> = ({ fileUrl }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        console.log("🔍 SimpleIFCViewer: fileUrl =", fileUrl);
        if (!containerRef.current) return;

        if (!fileUrl) {
            setError("No IFC file found for this job.");
            return;
        }

        // 1. Setup Scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf1f5f9); // Slate-50

        // 2. Setup Camera
        const camera = new THREE.PerspectiveCamera(75, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 1000);
        camera.position.set(10, 10, 10);

        // 3. Setup Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        containerRef.current.appendChild(renderer.domElement);

        // 4. Setup Controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;

        // 5. Lights
        const light = new THREE.DirectionalLight(0xffffff, 2);
        light.position.set(10, 10, 10);
        scene.add(light);
        scene.add(new THREE.AmbientLight(0xffffff, 1));

        // 6. Grid
        const grid = new THREE.GridHelper(50, 50);
        scene.add(grid);

        // 7. Load IFC
        const ifcLoader = new IFCLoader();

        // Setup WASM Path - Crucial!
        // We use the root path since we have the assets there and the server handling it
        ifcLoader.ifcManager.setWasmPath("/");

        // --- v4.2 Mod: Restored Worker + Headers ---
        console.log("🚀 Attempting to load IFC from URL (Worker Enabled):", fileUrl);
        // Use explicit worker path to ensure version alignment (v0.0.53 everywhere)
        ifcLoader.ifcManager.useWebWorkers(true, "web-ifc-mt.worker.js");

        ifcLoader.load(
            fileUrl,
            (model) => {
                scene.add(model);
                setLoadingProgress(100);

                // Fit Camera
                const box = new THREE.Box3().setFromObject(model);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                const fov = camera.fov * (Math.PI / 180);
                let cameraZ = Math.abs(maxDim / 2 * Math.tan(fov * 2));
                cameraZ *= 1.5; // Zoom out

                camera.position.set(center.x + cameraZ, center.y + cameraZ, center.z + cameraZ);
                camera.lookAt(center);
                controls.target.copy(center);
                controls.update();

                console.log("✅ Model Loaded Successfully");
            },
            (progress) => {
                const p = (progress.loaded / progress.total) * 100;
                setLoadingProgress(Math.round(p));
            },
            (err) => {
                console.error("❌ Error loading IFC:", err);
                setError("Failed to load IFC file.");
            }
        );

        // Animation Loop
        const animate = () => {
            requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        // Cleanup
        return () => {
            if (containerRef.current) {
                containerRef.current.innerHTML = '';
            }
            renderer.dispose();
        };
    }, [fileUrl]);

    return (
        <div className="relative w-full h-full">
            <div ref={containerRef} className="w-full h-full" />

            {loadingProgress < 100 && !error && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                    <div className="text-center">
                        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                        <p className="text-sm font-medium text-slate-600">Loading Model... {loadingProgress}%</p>
                    </div>
                </div>
            )}

            {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/90 z-20">
                    <div className="text-red-500 font-bold">{error}</div>
                </div>
            )}

            <div className="absolute top-2 right-2 bg-black/70 text-white text-xs p-1 rounded font-mono">
                Simple IFC Viewer v4.2 (Worker Enabled)
            </div>
        </div>
    );
};
