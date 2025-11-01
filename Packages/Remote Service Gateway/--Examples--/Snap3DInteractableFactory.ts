import { Snap3D } from "Remote Service Gateway/HostedSnap/Snap3D";
import { Snap3DTypes } from "Remote Service Gateway/HostedSnap/Snap3DTypes";
import { Snap3DInteractable } from "./Snap3DInteractable";
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider";

@component
export class Snap3DInteractableFactory extends BaseScriptComponent {
  @ui.separator
  @ui.group_start("AI Room Analysis Integration")
  @input @widget(new TextAreaWidget()) private roomAnalysis: string = "";
  @input @widget(new TextAreaWidget()) private designSuggestions: string = "";
  @input @widget(new TextAreaWidget()) private roomLayout: string = "";
  @input @widget(new TextAreaWidget()) private detectedStyle: string = ""; // NEW: Style from AI
  @input @widget(new TextAreaWidget()) private detectedColors: string = ""; // NEW: Colors from AI
  @input @widget(new TextAreaWidget()) private suggestedColors: string = ""; // NEW: AI suggested colors
  @input aiAssistantScript: ScriptComponent; // Reference to your OpenAI script
  @ui.group_end

  @ui.separator
  @ui.group_start("Speech Command & Manual Generation")
  @input @widget(new TextAreaWidget()) private prompt: string = "A beautifiul outdoor fountain";
  @input @widget(new TextAreaWidget()) private enhancedPrompt: string = ""; // AI-enhanced version
  @input private refineMesh: boolean = true;
  @input private useVertexColor: boolean = false;
  @input runOnTap: boolean = false;
  @ui.group_end

  @ui.separator
  @ui.group_start("Style & Color Enhancement Settings")
  @input private enableStyleMatching: boolean = true; // NEW: Enable style awareness
  @input private enableColorMatching: boolean = true; // NEW: Enable color awareness
  @input private colorIntensity: number = 0.7; // NEW: How strongly to apply colors (0-1)
  @ui.group_end

  @ui.separator
  @ui.group_start("ASR Integration")
  @input private enableSpeechControl: boolean = true;
  @input @widget(new TextAreaWidget()) private lastSpeechCommand: string = "";
  @input @widget(new TextAreaWidget()) private contextualizedPrompt: string = "";
  @ui.group_end

  @ui.separator
  @ui.group_start("Prefab Settings")
  @input snap3DInteractablePrefab: ObjectPrefab;
  @ui.group_end

  private availableToRequest: boolean = true;
  private wcfmp = WorldCameraFinderProvider.getInstance();
  private aiAnalysisData: any = {};
  private speechCommandQueue: Array<{command: string, timestamp: number}> = [];
  private contextualEnhancementEnabled: boolean = true;

  // NEW: Style and color data
  private currentRoomStyle: string = "";
  private currentColors: string[] = [];
  private suggestedColorPalette: string[] = [];

  onAwake() {
    this.createEvent("TapEvent").bind(() => {
      if (!this.runOnTap) {
        return;
      }
      this.createInteractable3DObject(this.prompt);
    });

    // Set up the API for receiving AI analysis data
    this.api.receiveRoomAnalysis = (data: any) => this.receiveRoomAnalysis(data);
    this.api.processSpeechCommand = (command: string) => this.processSpeechCommand(command);
    this.api.enhancePromptWithContext = (basePrompt: string) => this.enhancePromptWithContext(basePrompt);
    
    // NEW: API for receiving style and color data
    this.api.receiveStyleAndColors = (styleData: any) => this.receiveStyleAndColors(styleData);
    
    // Listen for updates to enhance prompts in real-time
    this.createEvent("UpdateEvent").bind(() => {
      this.checkForPromptEnhancements();
    });

    print("🎯 Enhanced Snap3D Factory initialized with AI analysis integration and style awareness");
  }

  /**
   * NEW: Receives style and color data from AI analysis
   */
  public receiveStyleAndColors(styleData: any) {
    print("🎨 Received style and color data from AI analysis");
    
    this.currentRoomStyle = styleData.style || "";
    this.detectedStyle = this.currentRoomStyle;
    
    // Parse detected colors
    if (styleData.colors) {
      this.detectedColors = styleData.colors;
      this.currentColors = this.parseColors(styleData.colors);
    }
    
    // Parse suggested colors from AI recommendations
    if (styleData.suggestedColors) {
      this.suggestedColors = styleData.suggestedColors;
      this.suggestedColorPalette = this.parseColors(styleData.suggestedColors);
    }
    
    print(`✅ Style: ${this.currentRoomStyle}, Colors: ${this.currentColors.join(', ')}`);
  }

  /**
   * Enhanced room analysis receiver - now extracts style and colors
   */
  public receiveRoomAnalysis(data: any) {
    print("📊 Received room analysis data");
    
    this.aiAnalysisData = data;
    this.roomAnalysis = data.analysis || "";
    this.designSuggestions = data.suggestions || "";
    this.roomLayout = data.layout || "";
    
    // NEW: Extract style and colors from analysis data
    if (data.style) {
      this.currentRoomStyle = data.style;
      this.detectedStyle = data.style;
    }
    
    if (data.colors) {
      this.detectedColors = data.colors;
      this.currentColors = this.parseColors(data.colors);
    }
    
    // Extract suggested colors from suggestions if available
    this.extractSuggestedColors(data.suggestions || "");
    
    // Update UI fields for visibility
    this.enhancedPrompt = this.generateContextualPrompt(this.prompt);
    
    print("✅ Room analysis integrated with style and color awareness. Ready for contextual generation.");
  }

  /**
   * Enhanced speech command processing with style and color awareness
   */
  public processSpeechCommand(command: string) {
    if (!this.enableSpeechControl) {
      print("❌ Speech control disabled");
      return;
    }

    print("🎤 Processing speech command: " + command);
    
    this.lastSpeechCommand = command;
    this.speechCommandQueue.push({
      command: command,
      timestamp: Date.now()
    });

    // Clean old commands
    this.cleanSpeechQueue();

    // NEW: Enhance with style and color awareness
    const styleColorEnhancedCommand = this.enhanceWithStyleAndColors(command);
    this.contextualizedPrompt = styleColorEnhancedCommand;

    // Auto-generate with enhanced prompt
    if (this.hasRoomAnalysis()) {
      this.createInteractable3DObject(styleColorEnhancedCommand);
    } else {
      this.createInteractable3DObject(command);
    }
  }

  /**
   * NEW: Enhance prompt with style and color matching
   */
  private enhanceWithStyleAndColors(basePrompt: string): string {
    let enhancedPrompt = basePrompt;

    // Apply style enhancement
    if (this.enableStyleMatching && this.currentRoomStyle) {
      enhancedPrompt = this.applyStyleEnhancement(enhancedPrompt, this.currentRoomStyle);
    }

    // Apply color enhancement
    if (this.enableColorMatching && (this.currentColors.length > 0 || this.suggestedColorPalette.length > 0)) {
      enhancedPrompt = this.applyColorEnhancement(enhancedPrompt);
    }

    return enhancedPrompt;
  }

  /**
   * NEW: Apply style-specific enhancements to prompt
   */
  private applyStyleEnhancement(prompt: string, style: string): string {
    const lowerStyle = style.toLowerCase();
    let styleEnhanced = prompt;

    // Add style-specific descriptors
    if (lowerStyle.includes('modern') || lowerStyle.includes('contemporary')) {
      styleEnhanced += " with clean modern lines, geometric forms";
    } else if (lowerStyle.includes('minimalist')) {
      styleEnhanced += " with minimalist design, simple clean aesthetics";
    } else if (lowerStyle.includes('industrial')) {
      styleEnhanced += " with industrial style, metal accents, raw materials";
    } else if (lowerStyle.includes('scandinavian') || lowerStyle.includes('nordic')) {
      styleEnhanced += " with Scandinavian design, natural materials, functional beauty";
    } else if (lowerStyle.includes('bohemian') || lowerStyle.includes('boho')) {
      styleEnhanced += " with bohemian style, eclectic patterns, textured surfaces";
    } else if (lowerStyle.includes('traditional') || lowerStyle.includes('classic')) {
      styleEnhanced += " with traditional design, classic proportions, refined details";
    } else if (lowerStyle.includes('rustic') || lowerStyle.includes('farmhouse')) {
      styleEnhanced += " with rustic charm, natural textures, weathered finishes";
    } else {
      // Generic style application
      styleEnhanced += ` in ${style} style`;
    }

    print(`🎨 Style enhancement applied: ${style}`);
    return styleEnhanced;
  }

  /**
   * NEW: Apply color matching to prompt
   */
  private applyColorEnhancement(prompt: string): string {
    let colorEnhanced = prompt;
    
    // Choose color palette - prefer suggested colors, fallback to detected colors
    const colorsToUse = this.suggestedColorPalette.length > 0 ? this.suggestedColorPalette : this.currentColors;
    
    if (colorsToUse.length === 0) return colorEnhanced;

    // Apply color intensity
    if (this.colorIntensity > 0.8) {
      // Strong color application
      const primaryColor = colorsToUse[0];
      const secondaryColor = colorsToUse.length > 1 ? colorsToUse[1] : primaryColor;
      colorEnhanced += ` with ${primaryColor} and ${secondaryColor} color scheme`;
    } else if (this.colorIntensity > 0.5) {
      // Moderate color application  
      const accentColor = colorsToUse[0];
      colorEnhanced += ` with ${accentColor} accents`;
    } else if (this.colorIntensity > 0.2) {
      // Subtle color application
      const toneColor = colorsToUse[0];
      colorEnhanced += ` with subtle ${toneColor} tones`;
    }

    print(`🌈 Color enhancement applied: ${colorsToUse.join(', ')} at ${this.colorIntensity} intensity`);
    return colorEnhanced;
  }

  /**
   * Enhanced prompt enhancement with style and color awareness
   */
  public enhancePromptWithContext(basePrompt: string): string {
    if (!this.contextualEnhancementEnabled || !this.hasRoomAnalysis()) {
      return basePrompt;
    }

    let enhancedPrompt = basePrompt;
    
    // Apply existing context enhancement
    if (this.roomLayout) {
      enhancedPrompt += ` designed for ${this.roomLayout}`;
    }

    // NEW: Apply style and color enhancements
    enhancedPrompt = this.enhanceWithStyleAndColors(enhancedPrompt);

    // Add style context from design suggestions
    if (this.designSuggestions) {
      const styleMatch = this.designSuggestions.match(/style[:\s]*([\w\s]+)/i);
      if (styleMatch && !this.currentRoomStyle) {
        enhancedPrompt += ` in ${styleMatch[1].trim()} style`;
      }
    }

    print("🎨 Enhanced prompt with style & colors: " + enhancedPrompt);
    return enhancedPrompt;
  }

  /**
   * NEW: Parse color strings into array of individual colors
   */
  private parseColors(colorString: string): string[] {
    if (!colorString) return [];
    
    // Common color parsing patterns
    const colors = colorString.toLowerCase()
      .split(/[,;&]|\s+and\s+|\s+or\s+/)
      .map(color => color.trim())
      .filter(color => color.length > 0)
      .filter(color => this.isValidColor(color));

    return colors;
  }

  /**
   * NEW: Validate if a string represents a color
   */
  private isValidColor(colorStr: string): boolean {
    const commonColors = [
      'white', 'black', 'gray', 'grey', 'brown', 'beige', 'cream', 'ivory',
      'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'violet',
      'navy', 'teal', 'cyan', 'magenta', 'gold', 'silver', 'copper',
      'warm', 'cool', 'neutral', 'earth', 'natural', 'muted', 'vibrant',
      'light', 'dark', 'soft', 'bold', 'pastel'
    ];

    return commonColors.some(validColor => colorStr.includes(validColor));
  }

  /**
   * NEW: Extract suggested colors from AI suggestions text
   */
  private extractSuggestedColors(suggestions: string) {
    if (!suggestions) return;

    // Look for color suggestions in the text
    const colorMatches = suggestions.match(/color[s]?[:\s]*([^.!?]+)/gi);
    if (colorMatches) {
      const extractedColors = colorMatches
        .map(match => match.replace(/color[s]?[:\s]*/gi, ''))
        .join(', ');
      
      if (extractedColors) {
        this.suggestedColors = extractedColors;
        this.suggestedColorPalette = this.parseColors(extractedColors);
        print(`🎯 Extracted suggested colors: ${this.suggestedColorPalette.join(', ')}`);
      }
    }
  }

  /**
   * Creates 3D interactable object with enhanced prompts (existing method - no changes)
   */
  createInteractable3DObject(
    input: string,
    overridePosition?: vec3
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.availableToRequest) {
        print("Already processing a request. Please wait.");
        reject("System busy");
        return;
      }

      this.availableToRequest = false;
      
      // Use enhanced prompt if available
      const finalPrompt = this.contextualEnhancementEnabled && this.hasRoomAnalysis() 
        ? this.enhancePromptWithContext(input)
        : input;

      print("🎯 Creating 3D object with prompt: " + finalPrompt);

      let outputObj = this.snap3DInteractablePrefab.instantiate(
        this.sceneObject
      );
      outputObj.name = "Snap3DInteractable - " + finalPrompt;

      let snap3DInteractable = outputObj.getComponent(
        Snap3DInteractable.getTypeName()
      );
      snap3DInteractable.setPrompt(finalPrompt);

      if (overridePosition) {
        outputObj.getTransform().setWorldPosition(overridePosition);
      } else {
        let newPos = this.wcfmp.getForwardPosition(80);
        outputObj.getTransform().setWorldPosition(newPos);
      }

      Snap3D.submitAndGetStatus({
        prompt: finalPrompt,
        format: "glb",
        refine: this.refineMesh,
        use_vertex_color: this.useVertexColor,
      })
        .then((submitGetStatusResults) => {
          submitGetStatusResults.event.add(([value, assetOrError]) => {
            if (value === "image") {
              assetOrError = assetOrError as Snap3DTypes.TextureAssetData;
              snap3DInteractable.setImage(assetOrError.texture);
            } else if (value === "base_mesh") {
              assetOrError = assetOrError as Snap3DTypes.GltfAssetData;
              if (!this.refineMesh) {
                snap3DInteractable.setModel(assetOrError.gltfAsset, true);
                this.availableToRequest = true;
                resolve("Successfully created mesh with prompt: " + finalPrompt);
              } else {
                snap3DInteractable.setModel(assetOrError.gltfAsset, false);
              }
            } else if (value === "refined_mesh") {
              assetOrError = assetOrError as Snap3DTypes.GltfAssetData;
              snap3DInteractable.setModel(assetOrError.gltfAsset, true);
              this.availableToRequest = true;
              resolve("Successfully created mesh with prompt: " + finalPrompt);
            } else if (value === "failed") {
              assetOrError = assetOrError as Snap3DTypes.ErrorData;
              print("Error: " + assetOrError.errorMsg);
              this.availableToRequest = true;
              reject("Failed to create mesh with prompt: " + finalPrompt);
            }
          });
        })
        .catch((error) => {
          snap3DInteractable.onFailure(error);
          print("Error submitting task or getting status: " + error);
          this.availableToRequest = true;
          reject("Failed to create mesh with prompt: " + finalPrompt);
        });
    });
  }

  // Existing utility methods remain unchanged
  private hasRoomAnalysis(): boolean {
    return !!(this.roomAnalysis || this.designSuggestions || this.roomLayout);
  }

  private cleanSpeechQueue() {
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    this.speechCommandQueue = this.speechCommandQueue
      .filter(cmd => cmd.timestamp > fiveMinutesAgo)
      .slice(-10);
  }

  private generateContextualPrompt(basePrompt: string): string {
    if (!this.hasRoomAnalysis()) {
      return basePrompt;
    }

    let contextual = basePrompt;
    
    if (this.roomLayout) {
      contextual += ` suitable for ${this.roomLayout}`;
    }
    
    return contextual;
  }

  private checkForPromptEnhancements() {
    if (this.prompt && this.hasRoomAnalysis()) {
      const newEnhanced = this.enhancePromptWithContext(this.prompt);
      if (newEnhanced !== this.enhancedPrompt) {
        this.enhancedPrompt = newEnhanced;
      }
    }
  }

  // Existing public API methods remain unchanged
  public isAvailable(): boolean {
    return this.availableToRequest;
  }

  public getAnalysisData(): any {
    return this.aiAnalysisData;
  }

  // NEW: Get current style and color data
  public getCurrentStyleData(): any {
    return {
      style: this.currentRoomStyle,
      detectedColors: this.currentColors,
      suggestedColors: this.suggestedColorPalette,
      colorIntensity: this.colorIntensity
    };
  }

  public getRecentSpeechCommands(): Array<{command: string, timestamp: number}> {
    return this.speechCommandQueue.slice(-5);
  }

  public enableContextualEnhancement(enabled: boolean) {
    this.contextualEnhancementEnabled = enabled;
    print(enabled ? "✅ Contextual enhancement enabled" : "❌ Contextual enhancement disabled");
  }

  // NEW: Enable/disable style and color matching
  public enableStyleAndColorMatching(styleEnabled: boolean, colorEnabled: boolean) {
    this.enableStyleMatching = styleEnabled;
    this.enableColorMatching = colorEnabled;
    print(`🎨 Style matching: ${styleEnabled ? 'ON' : 'OFF'}, Color matching: ${colorEnabled ? 'ON' : 'OFF'}`);
  }

  // NEW: Set color intensity
  public setColorIntensity(intensity: number) {
    this.colorIntensity = Math.max(0, Math.min(1, intensity));
    print(`🌈 Color intensity set to: ${this.colorIntensity}`);
  }

  public createContextualObject(basePrompt: string, additionalContext?: string): Promise<string> {
    let enhancedPrompt = this.enhancePromptWithContext(basePrompt);
    
    if (additionalContext) {
      enhancedPrompt += " " + additionalContext;
    }
    
    return this.createInteractable3DObject(enhancedPrompt);
  }

  public triggerContextualGeneration(analysisData: any, userPrompt: string) {
    this.receiveRoomAnalysis(analysisData);
    this.processSpeechCommand(userPrompt);
  }

  public resetAnalysis() {
    this.aiAnalysisData = {};
    this.roomAnalysis = "";
    this.designSuggestions = "";
    this.roomLayout = "";
    this.enhancedPrompt = "";
    this.contextualizedPrompt = "";
    this.speechCommandQueue = [];
    
    // NEW: Reset style and color data
    this.currentRoomStyle = "";
    this.detectedStyle = "";
    this.currentColors = [];
    this.detectedColors = "";
    this.suggestedColorPalette = [];
    this.suggestedColors = "";
    
    print("🔄 Analysis data and style/color data reset");
  }

  private onTap() {}
}