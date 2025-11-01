import { Interactable } from 'SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable';
import { InteractorEvent } from 'SpectaclesInteractionKit.lspkg/Core/Interactor/InteractorEvent';
import { SIK } from 'SpectaclesInteractionKit.lspkg/SIK';

enum ItemType {
    Item1 = "Item1",
    Item2 = "Item2",
    Item3 = "Item3"
}

/**
 * Controls item visibility with direct button-to-object mapping
 * CRITICAL: This script must be on an ENABLED object!
 */
@component export class FixedStyleControl extends BaseScriptComponent {
    // Item buttons (must have Interactable component)
    @input item1Button: SceneObject;
    @input item2Button: SceneObject;
    @input item3Button: SceneObject;
    
    // Item objects/groups to show/hide
    @input item1Object: SceneObject;
    @input item2Object: SceneObject;
    @input item3Object: SceneObject;
    
    // Optional debug display
    @input debugText: Text;
    
    private selectedItem: ItemType | null = null;
    private isInitialized: boolean = false;

    // Called after all objects are instantiated
    onAwake(): void {
        print("FixedStyleControl: Awake");
        
        // Create an event that will be triggered once SIK is fully initialized
        this.createEvent('OnStartEvent').bind(() => {
            this.onStartSetup();
        });
        
        // Force all objects to start disabled
        if (this.item1Object) this.item1Object.enabled = false;
        if (this.item2Object) this.item2Object.enabled = false;
        if (this.item3Object) this.item3Object.enabled = false;
        
        if (this.debugText) {
            this.debugText.text = "Select Item";
        }
    }
    
    // Called when the script component is started
    onStart(): void {
        print("FixedStyleControl: Start");
        // We'll let the OnStartEvent handle the actual setup 
        // to ensure SIK is fully initialized
    }
    
    // Setup that runs after SIK is properly initialized
    private onStartSetup(): void {
        print("FixedStyleControl: Running OnStartSetup");
        this.validateComponents();
        
        // Don't try to initialize if critical components are missing
        if (!this.checkRequiredComponents()) {
            print("FixedStyleControl: Missing critical components, initialization skipped");
            return;
        }
        
        this.setupButtonListeners();
    }
    
    // Perform components validation with helpful error messages
    private validateComponents(): void {
        // Check required button components
        if (!this.item1Button) print("ERROR: Item1 button not set");
        if (!this.item2Button) print("ERROR: Item2 button not set");
        if (!this.item3Button) print("ERROR: Item3 button not set");
        
        // Check required object components
        if (!this.item1Object) print("ERROR: Item1 object not set");
        if (!this.item2Object) print("ERROR: Item2 object not set");
        if (!this.item3Object) print("ERROR: Item3 object not set");
        
        // Check if interactables exist on buttons
        const interactionManager = SIK.InteractionManager;
        if (!interactionManager) {
            print("CRITICAL ERROR: SIK Interaction Manager not found!");
            return;
        }
        
        if (this.item1Button && !this.item1Button.getComponent(Interactable.getTypeName())) {
            print("ERROR: Item1 button has no Interactable component!");
        }
        
        if (this.item2Button && !this.item2Button.getComponent(Interactable.getTypeName())) {
            print("ERROR: Item2 button has no Interactable component!");
        }
        
        if (this.item3Button && !this.item3Button.getComponent(Interactable.getTypeName())) {
            print("ERROR: Item3 button has no Interactable component!");
        }
    }
    
    // Check if we have the minimum required components to function
    private checkRequiredComponents(): boolean {
        // Need at least one button and object pair to function
        const hasItemComponents = (
            SIK.InteractionManager != null &&
            ((this.item1Button != null && this.item1Object != null) ||
             (this.item2Button != null && this.item2Object != null) ||
             (this.item3Button != null && this.item3Object != null))
        );
        
        return hasItemComponents;
    }
    
    // Set up event listeners for buttons
    private setupButtonListeners(): void {
        const interactionManager = SIK.InteractionManager;
        print("Setting up button listeners");
        
        // Item1 button
        if (this.item1Button) {
            const item1Interactable = this.item1Button.getComponent(Interactable.getTypeName()) as Interactable;
            if (item1Interactable) {
                const onTriggerEndCallback = (event: InteractorEvent) => {
                    print("Item1 selected");
                    this.showItem(ItemType.Item1);
                };
                item1Interactable.onInteractorTriggerEnd.add(onTriggerEndCallback);
                print("Item1 button listener added");
            }
        }
        
        // Item2 button
        if (this.item2Button) {
            const item2Interactable = this.item2Button.getComponent(Interactable.getTypeName()) as Interactable;
            if (item2Interactable) {
                const onTriggerEndCallback = (event: InteractorEvent) => {
                    print("Item2 selected");
                    this.showItem(ItemType.Item2);
                };
                item2Interactable.onInteractorTriggerEnd.add(onTriggerEndCallback);
                print("Item2 button listener added");
            }
        }
        
        // Item3 button
        if (this.item3Button) {
            const item3Interactable = this.item3Button.getComponent(Interactable.getTypeName()) as Interactable;
            if (item3Interactable) {
                const onTriggerEndCallback = (event: InteractorEvent) => {
                    print("Item3 selected");
                    this.showItem(ItemType.Item3);
                };
                item3Interactable.onInteractorTriggerEnd.add(onTriggerEndCallback);
                print("Item3 button listener added");
            }
        }
        
        this.isInitialized = true;
        print("All button listeners set up!");
    }
    
    // Show the selected item and hide others
    private showItem(item: ItemType): void {
        print(`${item} Selected`);
        this.selectedItem = item;
        
        // Hide all objects first
        if (this.item1Object) this.item1Object.enabled = false;
        if (this.item2Object) this.item2Object.enabled = false;
        if (this.item3Object) this.item3Object.enabled = false;
        
        // Show only the selected item
        switch (item) {
            case ItemType.Item1:
                if (this.item1Object) {
                    this.item1Object.enabled = true;
                }
                break;
                
            case ItemType.Item2:
                if (this.item2Object) {
                    this.item2Object.enabled = true;
                }
                break;
                
            case ItemType.Item3:
                if (this.item3Object) {
                    this.item3Object.enabled = true;
                }
                break;
        }
        
        // Update debug text if available
        if (this.debugText) {
            this.debugText.text = `${item} Selected`;
        }
    }
    
    // Called every frame - use for debugging if needed
    onUpdate(): void {
        // For debugging only - uncomment if needed
        /*
        if (!this.isInitialized) {
            print("WARNING: Script not properly initialized!");
        }
        */
    }
}