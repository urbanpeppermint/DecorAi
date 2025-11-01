import { LoadingIndicator } from "./LoadingIndicator"
import { SpatialImageFrame } from "./SpatialImageFrame"

/**
* Event-driven SpatialGallery that updates only when explicitly notified of new images.
* No polling - relies on external scripts to trigger updates when images change.
*
* @version 3.0.0
*/
@component
export class SpatialGallery extends BaseScriptComponent {
@typename
SpatialImage: keyof ComponentNameMap

/**
* The SIK container frame that holds the image.
*/
@input
frame: SpatialImageFrame
/**
* The spatial image custom component.
*/
@input("SpatialImage")
image: any
/**
* The loading indicator to tell that the image is being spatialized.
*/
@input
loadingIndicator: LoadingIndicator
/**
* Array of Image components from your scene hierarchy to monitor
*/
@input
imageComponents: Image[]
/**
* Labels for each image component (optional, for debugging)
*/
@input
imageLabels: string[]
/**
* Reference to your OpenAI script component for coordination
*/
@input
oaiScript: ScriptComponent
/**
* If true, automatically show newly updated images
*/
@input
autoShowUpdates: boolean = true

private index: number = 0
private currentTextures: (Texture | null)[] = []
private validIndices: number[] = []

onAwake() {
    // Set up API first, before anything else
    this.setupAPI()
    
    this.createEvent("OnStartEvent").bind(() => {
        this.initializeImageTracking()
        this.initialiseFrame()
    })
}

/**
* Initialize tracking for all provided Image components
*/
private initializeImageTracking() {
    if (!this.imageComponents || this.imageComponents.length === 0) {
        print("❗ No Image components provided to SpatialGallery")
        return
    }
    
    // Initialize tracking arrays
    this.currentTextures = new Array(this.imageComponents.length).fill(null)
    this.validIndices = []
    
    // Check initial state of each Image component (one-time setup)
    for (let i = 0; i < this.imageComponents.length; i++) {
        this.updateImageComponent(i)
    }
    
    // Set initial index to first valid image
    if (this.validIndices.length > 0) {
        this.index = 0
    }
    
    print(`✅ SpatialGallery initialized with ${this.imageComponents.length} Image components, ${this.validIndices.length} valid`)
}

/**
* Setup the public API that other scripts can call
*/
private setupAPI() {
    // Ensure the sceneObject has an api property
    const sceneObj = this.sceneObject as any
    if (!sceneObj.api) {
        sceneObj.api = {}
    }
    
    // Expose methods that the OAI script can call
    sceneObj.api.notifyImageUpdated = (componentIndex: number) => {
        print(`🔔 SpatialGallery received notification for component ${componentIndex}`)
        this.onImageUpdated(componentIndex)
    }
    
    sceneObj.api.notifyGeneratedImageUpdated = () => {
        // Assumes generated image is the last component
        const generatedIndex = this.imageComponents ? this.imageComponents.length - 1 : 0
        print(`🔔 SpatialGallery received generated image notification (component ${generatedIndex})`)
        this.onImageUpdated(generatedIndex)
    }
    
    sceneObj.api.notifyCapturedImageUpdated = () => {
        // Assumes captured image is the first component
        print(`🔔 SpatialGallery received captured image notification (component 0)`)
        this.onImageUpdated(0)
    }
    
    sceneObj.api.forceRefresh = () => {
        print(`🔔 SpatialGallery received force refresh notification`)
        this.refreshAllImages()
    }
    
    print("✅ SpatialGallery API exposed for external scripts")
}

/**
* Called when an image has been updated (event-driven)
*/
private onImageUpdated(componentIndex: number) {
    if (componentIndex < 0 || componentIndex >= this.imageComponents.length) {
        print(`❗ Invalid component index: ${componentIndex}`)
        return
    }
    
    const wasUpdated = this.updateImageComponent(componentIndex)
    
    if (wasUpdated && this.autoShowUpdates) {
        // Small delay to ensure texture is fully loaded
        const delayedEvent = this.createEvent("DelayedCallbackEvent")
        delayedEvent.bind(() => {
            this.showImageComponent(componentIndex)
        })
        delayedEvent.reset(0.1)
    }
}

/**
* Update a specific Image component and check for texture changes
*/
public updateImageComponent(componentIndex: number): boolean {
    if (componentIndex >= this.imageComponents.length) return false
    
    const imageComp = this.imageComponents[componentIndex]
    if (!imageComp || !imageComp.mainPass) return false
    
    const currentTexture = imageComp.mainPass.baseTex
    const previousTexture = this.currentTextures[componentIndex]
    
    // Check if texture has changed
    if (currentTexture !== previousTexture) {
        this.currentTextures[componentIndex] = currentTexture
        
        if (currentTexture) {
            // Add to valid indices if not already present
            if (!this.validIndices.includes(componentIndex)) {
                this.validIndices.push(componentIndex)
                const label = this.getImageLabel(componentIndex)
                print(`✅ Added ${label} to spatial gallery (component ${componentIndex})`)
            } else {
                const label = this.getImageLabel(componentIndex)
                print(`🔄 Updated ${label} texture (component ${componentIndex})`)
            }
            
            return true
        } else {
            // Remove from valid indices if texture became null
            const validIndex = this.validIndices.indexOf(componentIndex)
            if (validIndex >= 0) {
                this.validIndices.splice(validIndex, 1)
                print(`❌ Removed component ${componentIndex} from gallery (texture became null)`)
            }
        }
    }
    
    return false
}

/**
* Get label for image component
*/
private getImageLabel(componentIndex: number): string {
    if (this.imageLabels && this.imageLabels[componentIndex]) {
        return this.imageLabels[componentIndex]
    }
    return `Image ${componentIndex}`
}

/**
* Show a specific Image component in the spatial gallery
*/
public showImageComponent(componentIndex: number) {
    const validIndex = this.validIndices.indexOf(componentIndex)
    if (validIndex >= 0) {
        this.setValidIndex(validIndex)
        const label = this.getImageLabel(componentIndex)
        print(`📸 Showing ${label} in spatial gallery`)
    }
}

/**
* Show the latest generated image (assumes it's the last component in the array)
*/
public showLatestGenerated() {
    if (this.imageComponents.length > 0) {
        const lastIndex = this.imageComponents.length - 1
        this.showImageComponent(lastIndex)
    }
}

/**
* Show captured image (assumes it's the first component in the array)
*/
public showCapturedImage() {
    if (this.imageComponents.length > 0) {
        this.showImageComponent(0)
    }
}

/**
* Moves the gallery to the previous image.
*/
public leftPressed(): void {
    if (this.validIndices.length === 0) return
    
    let newIndex = this.index - 1
    if (newIndex < 0) {
        newIndex = this.validIndices.length - 1
    }
    this.setValidIndex(newIndex)
}

/**
* Move the gallery to the next image.
*/
public rightPressed(): void {
    if (this.validIndices.length === 0) return
    
    this.setValidIndex((this.index + 1) % this.validIndices.length)
}

private initialiseFrame(): void {
    if (this.validIndices.length > 0) {
        this.setValidIndex(0)
    }

    this.image.onLoadingStart.add(() => {
        this.loadingIndicator.sceneObject.enabled = true
        this.loadingIndicator.reset()
    })

    this.image.onLoaded.add(() => {
        this.loadingIndicator.sceneObject.enabled = false
    })
}

/**
* Set the gallery to show a specific valid index
*/
private setValidIndex(newValidIndex: number) {
    if (this.validIndices.length === 0 || newValidIndex < 0 || newValidIndex >= this.validIndices.length) {
        return
    }
    
    this.index = newValidIndex
    const componentIndex = this.validIndices[newValidIndex]
    const texture = this.currentTextures[componentIndex]
    
    if (texture && this.frame) {
        // Force update the spatial frame with the new texture
        this.frame.setImage(texture, true)
        
        // Trigger spatialization update
        this.forceUpdateSpatialization(texture)
        
        const label = this.getImageLabel(componentIndex)
        print(`🖼️ Spatial gallery showing ${label} (valid index ${newValidIndex}, component ${componentIndex})`)
    }
}

/**
* Force update the spatialization system when texture changes
*/
private forceUpdateSpatialization(texture: Texture) {
    if (!this.image || !texture) return
    
    try {
        // Try to trigger re-spatialization by updating the spatial image component
        if (this.image.setTexture) {
            this.image.setTexture(texture)
        } else if (this.image.updateTexture) {
            this.image.updateTexture(texture)
        } else if (this.image.refresh) {
            this.image.refresh()
        }
        
        // Small delay to ensure proper update
        const delayedEvent = this.createEvent("DelayedCallbackEvent")
        delayedEvent.bind(() => {
            if (this.image.invalidate) {
                this.image.invalidate()
            }
        })
        delayedEvent.reset(0.1)
        
    } catch (error) {
        print("Note: Could not force spatialization update - " + error)
    }
}

/**
* Manual refresh of all image components (one-time check)
*/
public refreshAllImages() {
    print("🔄 Manual refresh of all image components...")
    
    for (let i = 0; i < this.imageComponents.length; i++) {
        this.updateImageComponent(i)
    }
    
    // Re-display current image
    if (this.validIndices.length > 0 && this.index < this.validIndices.length) {
        this.setValidIndex(this.index)
    }
}

/**
* Get current gallery state for debugging
*/
public getGalleryInfo() {
    return {
        totalComponents: this.imageComponents ? this.imageComponents.length : 0,
        validImages: this.validIndices.length,
        currentIndex: this.index,
        currentComponentIndex: this.validIndices[this.index] || -1,
        validIndices: [...this.validIndices],
        currentLabel: this.validIndices[this.index] !== undefined ? this.getImageLabel(this.validIndices[this.index]) : "None"
    }
}

/**
* Public methods for external notification (can be called by other scripts)
*/
public notifyImageGenerated(componentIndex: number = -1) {
    if (componentIndex === -1) {
        // Default to last component (generated image)
        componentIndex = this.imageComponents.length - 1
    }
    this.onImageUpdated(componentIndex)
}

public notifyImageCaptured(componentIndex: number = 0) {
    this.onImageUpdated(componentIndex)
}
}