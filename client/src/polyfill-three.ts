import * as THREE from 'three';

// --- POLYFILL: Restore traverseVisible for modern THREE.js compatibility ---
// OpenBIM Components v1.x relies on this method which was removed in THREE r159/r160
console.log("Three.js Polyfill: Checking for traverseVisible...");
if (typeof THREE.Object3D.prototype.traverseVisible !== 'function') {
    console.log("Three.js Polyfill: Applying traverseVisible patch.");
    THREE.Object3D.prototype.traverseVisible = function (callback: (object: THREE.Object3D) => any) {
        if (this.visible === false) return;
        callback(this);
        const children = this.children;
        for (let i = 0, l = children.length; i < l; i++) {
            children[i].traverseVisible(callback);
        }
    };
} else {
    console.log("Three.js Polyfill: traverseVisible already exists.");
}
// --------------------------------------------------------------------------
