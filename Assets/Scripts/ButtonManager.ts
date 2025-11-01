import { Interactable } from 'SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable';
import { InteractorEvent } from 'SpectaclesInteractionKit.lspkg/Core/Interactor/InteractorEvent';
import { SIK } from 'SpectaclesInteractionKit.lspkg/SIK';

enum ItemStyle {
    Item1 = "item1",
    Item2 = "item2",
    Item3 = "item3"
}

/**
 * CRITICAL: This script must be on an ENABLED object!
 */
@component export class FixedStyleControl extends BaseScriptComponent {
    @input item1Button: SceneObject;
    @input item2Button: SceneObject;
    @input item3Button: SceneObject;
    
    @input item1Object: SceneObject;
    @input item2Object: SceneObject;
    @input item3Object: SceneObject;
    
    @input debugText: Text;
    
    private selectedStyle: ItemStyle | null = null;
    private isInitialized: boolean = false;

    onAwake(): void {
        print("FixedStyleControl: Awake");
        
        this.createEvent('OnStartEvent').bind(() => {
            this.onStartSetup();
        });
        
        if (this.item1Object) this.item1Object.enabled = false;
        if (this.item2Object) this.item2Object.enabled = false;
        if (this.item3Object) this.item3Object.enabled = false;
        
        if (this.debugText) {
            this.debugText.text = "Design Your Way";
        }
    }
    
    onStart(): void {
        print("FixedStyleControl: Start");
    }
    
    private onStartSetup(): void {
        print("FixedStyleControl: Running OnStartSetup");
        this.validateComponents();
        
        if (!this.checkRequiredComponents()) {
            print("FixedStyleControl: Missing critical components, initialization skipped");
            return;
        }
        
        this.setupButtonListeners();
    }
    
    private validateComponents(): void {
        if (!this.item1Button) print("ERROR: item1 button not set");
        if (!this.item2Button) print("ERROR: item2 button not set");
        if (!this.item3Button) print("ERROR: item3 button not set");
        
        if (!this.item1Object) print("ERROR: item1 object not set");
        if (!this.item2Object) print("ERROR: item2 object not set");
        if (!this.item3Object) print("ERROR: item3 object not set");
        
        const interactionManager = SIK.InteractionManager;
        if (!interactionManager) {
            print("CRITICAL ERROR: SIK Interaction Manager not found!");
            return;
        }
        
        if (this.item1Button && !this.item1Button.getComponent(Interactable.getTypeName())) {
            print("ERROR: item1 button has no Interactable component!");
        }
        if (this.item2Button && !this.item2Button.getComponent(Interactable.getTypeName())) {
            print("ERROR: item2 button has no Interactable component!");
        }
        if (this.item3Button && !this.item3Button.getComponent(Interactable.getTypeName())) {
            print("ERROR: item3 button has no Interactable component!");
        }
    }
    
    private checkRequiredComponents(): boolean {
        const hasStyleComponents = (
            SIK.InteractionManager != null &&
            ((this.item1Button != null && this.item1Object != null) ||
             (this.item2Button != null && this.item2Object != null) ||
             (this.item3Button != null && this.item3Object != null))
        );
        return hasStyleComponents;
    }
    
    private setupButtonListeners(): void {
        const interactionManager = SIK.InteractionManager;
        print("Setting up button listeners");
        
        if (this.item1Button) {
            const interactable = this.item1Button.getComponent(Interactable.getTypeName()) as Interactable;
            if (interactable) {
                interactable.onInteractorTriggerEnd.add(() => {
                    print("item1 selected");
                    this.showStyle(ItemStyle.Item1);
                });
                print("item1 button listener added");
            }
        }
        
        if (this.item2Button) {
            const interactable = this.item2Button.getComponent(Interactable.getTypeName()) as Interactable;
            if (interactable) {
                interactable.onInteractorTriggerEnd.add(() => {
                    print("item2 selected");
                    this.showStyle(ItemStyle.Item2);
                });
                print("item2 button listener added");
            }
        }
        
        if (this.item3Button) {
            const interactable = this.item3Button.getComponent(Interactable.getTypeName()) as Interactable;
            if (interactable) {
                interactable.onInteractorTriggerEnd.add(() => {
                    print("item3 selected");
                    this.showStyle(ItemStyle.Item3);
                });
                print("item3 button listener added");
            }
        }
        
        this.isInitialized = true;
        print("All button listeners set up!");
    }
    
    private showStyle(style: ItemStyle): void {
        print(`${style} selected`);
        this.selectedStyle = style;
        
        if (this.item1Object) this.item1Object.enabled = false;
        if (this.item2Object) this.item2Object.enabled = false;
        if (this.item3Object) this.item3Object.enabled = false;
        
        switch(style) {
            case ItemStyle.Item1:
                if (this.item1Object) this.item1Object.enabled = true;
                break;
            case ItemStyle.Item2:
                if (this.item2Object) this.item2Object.enabled = true;
                break;
            case ItemStyle.Item3:
                if (this.item3Object) this.item3Object.enabled = true;
                break;
        }
        
        if (this.debugText) {
            this.debugText.text = `${style} Selected`;
        }
    }
    
    onUpdate(): void {
        // No per-frame logic needed
    }
}
