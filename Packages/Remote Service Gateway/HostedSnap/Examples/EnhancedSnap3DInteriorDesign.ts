import { Snap3D } from 'Remote Service Gateway/HostedSnap/Snap3D';
import { Snap3DTypes } from 'Remote Service Gateway/HostedSnap/Snap3DTypes';
import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";

@component
export class EnhancedSnap3DInteriorDesign extends BaseScriptComponent {
  @ui.separator
  @ui.group_start("AI Analysis Data - Auto Received")
  @input @widget(new TextAreaWidget()) private roomAnalysis: string = "";
  @input @widget(new TextAreaWidget()) private designSuggestions: string = "";
  @input @widget(new TextAreaWidget()) private roomLayout: string = "";
  @input @widget(new TextAreaWidget()) private roomType: string = "";
  @input @widget(new TextAreaWidget()) private roomStyle: string = "";
  @input @widget(new TextAreaWidget()) private roomColors: string = "";
  @input @widget(new TextAreaWidget()) private roomEnvironment: string = "";
  @ui.group_end

  @ui.separator
  @ui.group_start("3D Generation Settings")
  @input private refineMesh: boolean = true;
  @input private useVertexColor: boolean = false;
  @input @label("Auto-enhance prompts with AI data") private enhancePrompts: boolean = true;
  @ui.group_end

  @ui.separator
  @ui.group_start("Single Target Item - AI Generated")
  @input @widget(new TextAreaWidget()) private targetItemDescription: string = "";
  @input @widget(new TextAreaWidget()) private itemPriority: string = "";
  @input @widget(new TextAreaWidget()) private generatedItemsHistory: string = "";
  @ui.group_end

  @ui.separator
  @ui.group_start("3D Asset Display")
  @input imageRoot: Image;
  @input singleItemRoot: SceneObject;
  @input modelMat: Material;
  @input hintText: Text;
  @input interactableObject: SceneObject;
  @ui.group_end

  @ui.separator
  @ui.group_start("AI Integration")
  @input aiAssistantScript: ScriptComponent;
  @input snap3DFactory: ScriptComponent;
  @ui.group_end

  private loaderSpinnerImage: SceneObject;
  private singleItemSpinner: SceneObject;
  private currentItemSceneObject: SceneObject = null;

  private availableToRequest: boolean = false;
  private isGenerating: boolean = false;
  private hasValidAnalysis: boolean = false;

  private gestureModule: GestureModule = require("LensStudio:GestureModule");
  private interactable: Interactable | null = null;

  private aiAnalysisData: {
    analysis: string;
    suggestions: string;
    layout: string;
    roomType: string;
    style: string;
    colors: string;
    environment: string;
    targetItem: string;
    generatedItems: string[];
  } = {
    analysis: "",
    suggestions: "",
    layout: "",
    roomType: "",
    style: "",
    colors: "",
    environment: "",
    targetItem: "",
    generatedItems: []
  };

  private enhancedPrompt: string = "";

  onAwake() {
    this.initializeSpinners();
    this.imageRoot.enabled = false;
    this.setupInteraction();
    this.setupGestures();
    this.availableToRequest = false;
    this.hasValidAnalysis = false;
    this.hintText.text = "Décor Assistant Ready";
    
    this.setupAPIEndpoints();
  }

  private setupAPIEndpoints() {
    this.api.triggerSingleItemGeneration = (data: any) => this.triggerSingleItemGeneration(data);
    this.api.generateSingleItem = (data: any) => this.triggerSingleItemGeneration(data);
    this.api.autoGenerateSingleItem = (data: any) => this.triggerSingleItemGeneration(data);
    this.api.receiveSingleItemRequest = (data: any) => this.triggerSingleItemGeneration(data);
    this.api.updateAIAnalysisData = (data: any) => this.updateAIAnalysisData(data);
    this.api.regenerateCurrentItem = () => this.regenerateCurrentItem();
    this.api.resetGenerator = () => this.resetGeneratorState();
    this.api.clearItemHistory = () => this.clearGeneratedItemsHistory();
  }

  private setupInteraction() {
    if (this.interactableObject) {
      this.interactable = this.interactableObject.getComponent(Interactable.getTypeName());
      if (!isNull(this.interactable)) {
        this.interactable.onTriggerEnd.add(() => {
          this.handleInteractableTrigger();
        });
      }
    }
  }

  private setupGestures() {
    if (!global.deviceInfoSystem.isEditor()) {
      this.gestureModule.getPinchDownEvent(GestureModule.HandType.Right).add(() => {
        this.handleInteractableTrigger();
      });
    }
  }

  private handleInteractableTrigger() {
    if (this.isGenerating) {
      this.hintText.text = "Generation in progress...";
      return;
    }

    if (!this.hasValidAnalysis) {
      this.hintText.text = "Waiting for AI analysis...";
      return;
    }

    this.regenerateCurrentItem();
  }

  public triggerSingleItemGeneration(data: any) {
    if (this.isGenerating) {
      this.delayedCallback(2.0, () => this.triggerSingleItemGeneration(data));
      return;
    }

    this.updateAIAnalysisData(data);
    this.updateUIFields();
    this.hasValidAnalysis = true;
    
    this.startSingleItemGeneration();
  }

  private updateAIAnalysisData(data: any) {
    this.aiAnalysisData = {
      analysis: data.analysis || "",
      suggestions: data.suggestions || "",
      layout: data.layout || "",
      roomType: data.roomType || "",
      style: data.style || "",
      colors: data.colors || "",
      environment: data.environment || "",
      targetItem: data.targetItem || "",
      generatedItems: data.generatedItems || []
    };
  }

  private updateUIFields() {
    this.roomAnalysis = this.aiAnalysisData.analysis;
    this.designSuggestions = this.aiAnalysisData.suggestions;
    this.roomLayout = this.aiAnalysisData.layout;
    this.roomType = this.aiAnalysisData.roomType;
    this.roomStyle = this.aiAnalysisData.style;
    this.roomColors = this.aiAnalysisData.colors;
    this.roomEnvironment = this.aiAnalysisData.environment;
    this.targetItemDescription = this.aiAnalysisData.targetItem;
    this.generatedItemsHistory = this.aiAnalysisData.generatedItems.join(', ');
  }

  private startSingleItemGeneration() {
    if (!this.aiAnalysisData.targetItem) {
      this.hintText.text = "No target item from AI";
      return;
    }

    if (this.isGenerating) {
      return;
    }

    this.isGenerating = true;
    this.availableToRequest = false;
    this.enhancedPrompt = this.buildEnhancedPrompt();
    
    // Send to factory instead of generating directly
    this.sendToFactory();
  }

  private buildEnhancedPrompt(): string {
    let prompt = this.aiAnalysisData.targetItem;
    
    if (this.enhancePrompts) {
      const contextParts = [];
      
      if (this.aiAnalysisData.style) {
        contextParts.push(`${this.aiAnalysisData.style} style`);
      }
      
      if (this.aiAnalysisData.colors) {
        contextParts.push(`${this.aiAnalysisData.colors} colors`);
      }
      
      if (this.aiAnalysisData.environment) {
        contextParts.push(`${this.aiAnalysisData.environment} setting`);
      }
      
      if (this.aiAnalysisData.roomType) {
        contextParts.push(`for ${this.aiAnalysisData.roomType}`);
      }
      
      if (contextParts.length > 0) {
        prompt = `${prompt}, ${contextParts.join(', ')}`;
      }
    }
    
    return prompt;
  }

  private sendToFactory() {
    if (!this.snap3DFactory?.api) {
      this.hintText.text = "Factory not connected";
      this.isGenerating = false;
      return;
    }

    const itemType = this.extractItemType(this.aiAnalysisData.targetItem);
    const environmentText = this.aiAnalysisData.environment || "space";
    this.hintText.text = `Generating ${itemType} for ${environmentText}...`;

    const generationData = {
      prompt: this.enhancedPrompt,
      targetItem: this.aiAnalysisData.targetItem,
      roomType: this.aiAnalysisData.roomType,
      style: this.aiAnalysisData.style,
      colors: this.aiAnalysisData.colors,
      environment: this.aiAnalysisData.environment,
      layout: this.aiAnalysisData.layout,
      suggestions: this.aiAnalysisData.suggestions,
      analysis: this.aiAnalysisData.analysis,
      generatedItems: this.aiAnalysisData.generatedItems,
      refineMesh: this.refineMesh,
      useVertexColor: this.useVertexColor
    };

    // Try multiple factory API methods
    const methods = [
      'receiveSingleItemRequest',
      'generateItem',
      'startGeneration',
      'triggerGeneration'
    ];
    
    let methodCalled = false;
    for (const method of methods) {
      if (this.snap3DFactory.api[method]) {
        this.snap3DFactory.api[method](generationData);
        methodCalled = true;
        break;
      }
    }

    if (!methodCalled) {
      this.hintText.text = "Factory method not found";
      this.isGenerating = false;
    }

    // Set completion callback
    this.delayedCallback(1.0, () => {
      this.isGenerating = false;
      this.availableToRequest = true;
    });
  }

  private extractItemType(description: string): string {
    const lowerDesc = description.toLowerCase();
    
    if (lowerDesc.includes('lamp') || lowerDesc.includes('light')) return 'lighting';
    if (lowerDesc.includes('chair') || lowerDesc.includes('sofa') || lowerDesc.includes('seat')) return 'seating';
    if (lowerDesc.includes('table')) return 'table';
    if (lowerDesc.includes('art') || lowerDesc.includes('painting') || lowerDesc.includes('mirror')) return 'wall art';
    if (lowerDesc.includes('plant') || lowerDesc.includes('planter')) return 'plant';
    if (lowerDesc.includes('rug') || lowerDesc.includes('carpet')) return 'flooring';
    if (lowerDesc.includes('shelf') || lowerDesc.includes('storage')) return 'storage';
    
    return 'décor';
  }

  private regenerateCurrentItem() {
    if (!this.hasValidAnalysis) {
      this.hintText.text = "Waiting for AI analysis...";
      return;
    }

    if (!this.aiAnalysisData.targetItem) {
      this.hintText.text = "No AI target item";
      return;
    }

    this.startSingleItemGeneration();
  }

  private initializeSpinners() {
    this.loaderSpinnerImage = this.imageRoot.sceneObject.getChild(1);
    this.singleItemSpinner = this.singleItemRoot.getChild(1);
    this.enableSpinner(false);
  }

  private enableSpinner(enable: boolean) {
    if (this.loaderSpinnerImage) this.loaderSpinnerImage.enabled = enable;
    if (this.singleItemSpinner) this.singleItemSpinner.enabled = enable;
  }

  private delayedCallback(delayTime: number, callback: () => void) {
    const delayedCallbackEvent = this.createEvent("DelayedCallbackEvent");
    delayedCallbackEvent.bind(callback);
    delayedCallbackEvent.reset(delayTime);
  }

  public isReadyForGeneration(): boolean {
    return this.availableToRequest && !this.isGenerating && this.hasValidAnalysis;
  }

  public getGenerationStatus() {
    return {
      isGenerating: this.isGenerating,
      hasValidAnalysis: this.hasValidAnalysis,
      hasTargetItem: !!this.aiAnalysisData.targetItem,
      currentTargetItem: this.aiAnalysisData.targetItem,
      generatedItemsCount: this.aiAnalysisData.generatedItems.length,
      aiAnalysisData: this.aiAnalysisData
    };
  }

  public resetGeneratorState() {
    this.isGenerating = false;
    this.availableToRequest = false;
    this.hasValidAnalysis = false;
    this.hintText.text = "Waiting for AI analysis...";
    
    this.enhancedPrompt = "";
    this.targetItemDescription = "";
    this.itemPriority = "";
    this.generatedItemsHistory = "";
    
    this.roomAnalysis = this.designSuggestions = this.roomLayout = "";
    this.roomType = this.roomStyle = this.roomColors = this.roomEnvironment = "";
    
    this.aiAnalysisData = {
      analysis: "",
      suggestions: "",
      layout: "",
      roomType: "",
      style: "",
      colors: "",
      environment: "",
      targetItem: "",
      generatedItems: []
    };
  }

  public clearGeneratedItemsHistory() {
    this.aiAnalysisData.generatedItems = [];
    this.generatedItemsHistory = "";
  }

  public updateAIAnalysisDataExternal(data: any) {
    this.updateAIAnalysisData(data);
    this.updateUIFields();
    this.hasValidAnalysis = true;
  }

  public getAIAnalysisData() {
    return this.aiAnalysisData;
  }

  public setEnhancePrompts(enhance: boolean) {
    this.enhancePrompts = enhance;
  }

  public hasValidAIAnalysis(): boolean {
    return this.hasValidAnalysis && !!this.aiAnalysisData.targetItem;
  }

  public getCurrentTargetItem(): string {
    return this.aiAnalysisData.targetItem;
  }

  public getGeneratedItemsHistory(): string[] {
    return this.aiAnalysisData.generatedItems;
  }

  public getEnhancedPrompt(): string {
    return this.enhancedPrompt;
  }
}