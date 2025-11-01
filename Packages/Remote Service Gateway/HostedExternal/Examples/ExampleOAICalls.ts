import { AudioProcessor } from "../../Helpers/AudioProcessor";
import { DynamicAudioOutput } from "../../Helpers/DynamicAudioOutput";
import { MicrophoneRecorder } from "../../Helpers/MicrophoneRecorder";
import { OpenAI } from "../OpenAI";
import { OpenAITypes } from "../OpenAITypes";
import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";

@component
export class ExampleOAICalls extends BaseScriptComponent {
  @ui.separator
  @ui.group_start("Chat Completions Example")
  @input textDisplay: Text;
  @input @widget(new TextAreaWidget()) private systemPrompt: string = "You are an expert interior designer. Generate a DALL·E prompt to redesign this exact room. Keep the same layout, furniture placement, and wall structure. Focus improvements on decor, lighting, colors, materials, and art. Avoid changing camera angle or architecture";
  @input @widget(new TextAreaWidget()) private userPrompt: string = "how to redecorate this area";
  @input @label("Run On Tap") private doChatCompletionsOnTap: boolean = false;
  @input private spatialGallery: ScriptComponent;
  @ui.group_end

  @ui.separator
  @ui.group_start("Image Generation Example")
  @input private imgObject: SceneObject;
  @input @widget(new TextAreaWidget()) private imageGenerationPrompt: string = "Image of captured area with Interior design or Outdoor improvement suggestions";
  @input @label("Run On Tap") private generateImageOnTap: boolean = false;
  @ui.group_end

  @ui.separator
  @ui.group_start("Voice Generation Example")
  @input @widget(new TextAreaWidget()) private voiceGenerationInstructions: string = "Neutral, very calm voice, talking like a therapist";
  @input @label("Run On Tap") private generateVoiceOnTap: boolean = false;
  @ui.group_end

  @ui.separator
  @ui.group_start("Function Calling Example")
  @input @widget(new TextAreaWidget()) private functionCallingPrompt: string = "Make the text display yellow";
  @input @label("Run On Tap") private doFunctionCallingOnTap: boolean = false;
  @ui.group_end

  @ui.separator
  @ui.group_start("Interior Design Analysis")
  @input private capturedImage: Image;
  @input private generatedDecorImage: Image;
  @input private textInput: Text;
  @input private textOutput: Text;
  @input private interactableObject: SceneObject;
  @input private snap3DGenerator: ScriptComponent;
  @input private snap3DFactory: ScriptComponent;
  @input @widget(new TextAreaWidget()) private interiorDesignPrompt: string = "Analyze this room and suggest three short and smart improvements";
  @input @label("Run Interior Design On Tap") private doInteriorDesignOnTap: boolean = false;
  @input @label("Auto-trigger 3D Generation") private autoTrigger3D: boolean = true;
  @input @label("Auto-generate Voice from Analysis") private autoGenerateVoice: boolean = true;
  @input @label("Auto-search Shopping Items") private autoSearchShopping: boolean = true;
  @ui.group_end

  @ui.separator
  @ui.group_start("Shopping Search Results")
  @input private shoppingResultImage: Image;
  @input private shoppingInfoText: Text;
  @input private priceText: Text;
  @input private storeText: Text;
  @input private locationText: Text;
  @input @label("Enable Location-based Search") private useLocationSearch: boolean = true;
  @ui.group_end
  
  private rmm = require("LensStudio:RemoteMediaModule") as RemoteMediaModule;
  private gestureModule: GestureModule = require("LensStudio:GestureModule");
  private SIK = require("SpectaclesInteractionKit.lspkg/SIK").SIK;
  private interactionManager = this.SIK.InteractionManager;
  private locationModule: RawLocationModule;
  private isProcessing: boolean = false;
  private interactable: Interactable | null = null;

  private currentAnalysis: string = "";
  private currentSuggestions: string = "";
  private currentLayout: string = "";
  private currentRoomType: string = "";
  private currentStyle: string = "";
  private currentColors: string = "";
  private currentEnvironment: string = "";

  // Track generated items to avoid repetition
  private generatedItems: string[] = [];
  private currentTargetItem: string = "";
  
  // Shopping search data
  private currentProductInfo: {
    name: string;
    price: string;
    store: string;
    imageUrl: string;
    description: string;
    location: string;
    distance: string;
  } = {
    name: "",
    price: "",
    store: "",
    imageUrl: "",
    description: "",
    location: "",
    distance: ""
  };

  private userLocation: {
    latitude: number;
    longitude: number;
    city: string;
    country: string;
  } = {
    latitude: 0,
    longitude: 0,
    city: "",
    country: ""
  };

  onAwake() {
    this.interactable = this.interactableObject.getComponent(Interactable.getTypeName());
    if (isNull(this.interactable)) {
      print("Interactable component not found on interactableObject.");
    } else {
      this.interactable.onTriggerEnd.add(() => {
        print("Interactable triggered - launching manual 3D generation...");
        this.handleInteriorDesignTrigger();
      });
      print("Interactable trigger bound successfully");
    }
    this.setupInteraction();
    this.setupGestures();
    this.initializeLocationService();
  }

  private initializeLocationService() {
    try {
      this.locationModule = require("LensStudio:RawLocationModule") as RawLocationModule;
      if (this.useLocationSearch) {
        this.requestUserLocation();
      }
    } catch (error) {
      print("RawLocationModule not available: " + error);
      this.useLocationSearch = false;
      this.setDefaultLocation();
    }
  }

  private setDefaultLocation() {
    this.userLocation = {
      latitude: 41.9028,
      longitude: 12.4964,
      city: "Rome",
      country: "Italy"
    };
    
    if (this.locationText) {
      this.locationText.text = `${this.userLocation.city}, ${this.userLocation.country} (default)`;
    }
    
    print("Using default location: Rome, Italy");
  }

  private requestUserLocation() {
    this.setDefaultLocation();
    
    try {
      if (this.locationModule) {
        print("RawLocationModule available, using default location for now");
      }
    } catch (error) {
      print("Location access not available: " + error);
    }
  }

  private async reverseGeocode(lat: number, lng: number) {
    try {
      const response = await OpenAI.chatCompletions({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Convert GPS coordinates to approximate city and country. Return only JSON:
            {
              "city": "city name",
              "country": "country name",
              "region": "state/region if applicable"
            }
            
            Use your geographic knowledge to estimate the location.`,
          },
          {
            role: "user",
            content: `What city and country is at coordinates: ${lat}, ${lng}?`,
          },
        ],
      });

      const jsonResponse = response.choices[0].message.content?.trim() || "";
      
      try {
        const locationData = JSON.parse(jsonResponse.replace(/```json|```/g, '').trim());
        this.userLocation.city = locationData.city || "";
        this.userLocation.country = locationData.country || "";
        
        if (this.locationText) {
          this.locationText.text = `${this.userLocation.city}, ${this.userLocation.country}`;
        }
        
        print(`Location resolved: ${this.userLocation.city}, ${this.userLocation.country}`);
      } catch (parseError) {
        print("Failed to parse location data: " + parseError);
      }
    } catch (error) {
      print("Reverse geocoding failed: " + error);
    }
  }

  private setupInteraction() {
    if (this.interactableObject) {
      const interactable = this.interactionManager.getInteractableBySceneObject(this.interactableObject);
      if (interactable) {
        interactable.onInteractorTriggerEnd(() => this.handleInteriorDesignTrigger());
      }
    }
  }

  private setupGestures() {
    if (global.deviceInfoSystem.isEditor()) {
      this.createEvent("TapEvent").bind(() => this.onTap());
    } else {
      this.gestureModule.getPinchDownEvent(GestureModule.HandType.Right).add(() => this.onTap());
    }
  }

  private onTap() {
    if (this.generateVoiceOnTap) this.doSpeechGeneration();
    if (this.generateImageOnTap) this.doImageGeneration();
    if (this.doChatCompletionsOnTap) this.doChatCompletions();
    if (this.doFunctionCallingOnTap) this.doFunctionCalling();
    if (this.doInteriorDesignOnTap) this.handleInteriorDesignTrigger();
  }

  private async handleInteriorDesignTrigger() {
    if (this.isProcessing || !this.textInput.text || !this.capturedImage) {
      print("Missing input values or already processing.");
      return;
    }

    this.isProcessing = true;
    this.textOutput.text = "Analyzing for design improvements...";

    try {
      const texture = this.capturedImage.mainPass.baseTex;
      if (!texture) {
        this.textOutput.text = "Error: No image texture found";
        return;
      }

      const base64Image = await this.encodeTextureToBase64(texture);
      
      print("═══════════════════════════════════════");
      print("🎯 STARTING AI ROOM ANALYSIS");
      print("═══════════════════════════════════════");
      
      const [roomAnalysisData, designAnalysis] = await Promise.all([
        this.analyzeRoomComprehensively(base64Image),
        this.analyzeInteriorDesign(base64Image)
      ]);

      if (designAnalysis && roomAnalysisData) {
        this.storeAnalysisResults(roomAnalysisData, designAnalysis);
        this.textOutput.text = designAnalysis;
        print("✓ Interior Design Analysis Complete");
        print("  Room Type: " + this.currentRoomType);
        print("  Style: " + this.currentStyle);
        print("  Colors: " + this.currentColors);
        print("  Environment: " + this.currentEnvironment);

        // Keep 2D image generation unchanged
        this.generateDecorImage(`${designAnalysis}. Layout: ${roomAnalysisData.layout}`, base64Image);

        // Generate single targeted item description
        print("\n🎨 GENERATING SINGLE TARGET ITEM...");
        await this.generateSingleItemDescription(base64Image, roomAnalysisData);

        if (this.autoGenerateVoice) {
          this.delayedCallback(1.0, () => this.generateVoiceFromText(this.textOutput.text));
        }

        // Auto-search for shopping items if enabled
        if (this.autoSearchShopping && this.currentTargetItem) {
          this.delayedCallback(2.5, () => this.searchShoppingItems());
        }

        this.delayedCallback(2.0, () => this.sendDataTo3DGenerator());
      }
    } catch (err) {
      print("ERROR: " + err);
      this.textOutput.text = "Error occurred during analysis";
    } finally {
      this.isProcessing = false;
    }
  }

  private storeAnalysisResults(roomData: any, analysis: string) {
    this.currentAnalysis = analysis;
    this.currentSuggestions = roomData.suggestions;
    this.currentLayout = roomData.layout;
    this.currentRoomType = roomData.roomType;
    this.currentStyle = roomData.style;
    this.currentColors = roomData.colors;
    this.currentEnvironment = roomData.environment;
  }

  private async generateSingleItemDescription(base64Image: string, roomData: any): Promise<void> {
    try {
      const previousItemsContext = this.generatedItems.length > 0 ? 
        `Previously suggested items to avoid repeating: ${this.generatedItems.join(', ')}. ` : '';

      print("  Previous items: " + (this.generatedItems.length > 0 ? this.generatedItems.join(', ') : "none"));

      const response = await OpenAI.chatCompletions({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert interior designer. Analyze this space and identify the ONE most impactful item that would improve this room the most.

            ${previousItemsContext}Focus on what's truly missing or needs replacing/upgrading.

            CRITICAL: Return ONLY valid JSON with no markdown, no code blocks, no extra text.

            PLACEMENT DETECTION:
            - HORIZONTAL (surface placement): furniture/decor for horizontal surfaces (sofas, tables, plants, lamps, vases, cushions)
            - VERTICAL (wall placement): items for vertical surfaces (wall art, mirrors, shelves, mounted decor)
            - FLOORING (ground covering): floor materials (rugs, tiles, carpet, grass tiles)

            ENVIRONMENT DETECTION:
            - INDOOR: furniture, rugs, wall art, floor tiles, lamps, mirrors
            - OUTDOOR: outdoor furniture, plants, garden art, grass/stone tiles, outdoor lighting

            PRIORITY IMPROVEMENTS (choose ONE most impactful):
            1. Missing essential furniture (seating, tables, storage)
            2. Poor lighting (add lamps, fixtures)
            3. Empty walls (wall art, mirrors, shelves)
            4. Worn/mismatched furniture (replacement pieces)
            5. Lack of color/texture (rugs, cushions, plants)
            6. Floor improvements (rugs, better flooring)

            Return ONLY this JSON structure with NO markdown formatting:
            {
              "targetItem": "detailed 25-35 word description of the ONE most needed item with specific style, material, color and purpose details",
              "placement": "horizontal, vertical, or flooring",
              "priority": "brief explanation why this item is most important",
              "category": "furniture, lighting, decor, flooring, or art"
            }

            Match the ${roomData.environment} environment, ${roomData.style} style, and ${roomData.colors} colors.`,
          },
          {
            role: "user",
            content: [
              { 
                type: "text", 
                text: `Identify the ONE most impactful improvement for this ${roomData.environment} ${roomData.roomType} space with ${roomData.style} style and ${roomData.colors} colors. Layout: ${roomData.layout}. Return ONLY JSON, no markdown.` 
              },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
            ],
          },
        ],
      });

      let jsonResponse = response.choices[0].message.content?.trim() || "";
      
      // Enhanced JSON cleaning - remove ALL markdown artifacts
      print("  Raw AI response length: " + jsonResponse.length + " chars");
      print("  First 150 chars: " + jsonResponse.substring(0, 150));
      
      // Remove markdown code blocks
      if (jsonResponse.includes('```json')) {
        jsonResponse = jsonResponse.split('```json')[1].split('```')[0].trim();
        print("  ✓ Removed ```json markdown wrapper");
      } else if (jsonResponse.includes('```')) {
        jsonResponse = jsonResponse.split('```')[1].split('```')[0].trim();
        print("  ✓ Removed ``` markdown wrapper");
      }
      
      // Remove any leading/trailing whitespace and newlines
      jsonResponse = jsonResponse.trim();
      
      // Find JSON object boundaries
      const startIdx = jsonResponse.indexOf('{');
      const endIdx = jsonResponse.lastIndexOf('}');
      
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        jsonResponse = jsonResponse.substring(startIdx, endIdx + 1);
        print("  ✓ Extracted JSON from position " + startIdx + " to " + endIdx);
      }
      
      print("  Cleaned JSON length: " + jsonResponse.length + " chars");
      
      try {
        const itemData = JSON.parse(jsonResponse);
        
        // Validate that we got actual content
        if (itemData.targetItem && itemData.targetItem.length > 10 && itemData.category) {
          this.currentTargetItem = itemData.targetItem;
          
          // Add to generated items list with more detail to avoid repetition
          const itemIdentifier = `${itemData.category}:${itemData.placement}:${itemData.priority.substring(0, 30)}`;
          this.generatedItems.push(itemIdentifier);
          
          // Keep only last 6 items to prevent infinite avoidance
          if (this.generatedItems.length > 6) {
            this.generatedItems.shift();
          }

          print("  ═══════════════════════════════════════");
          print("  ✓ AI-GENERATED TARGET ITEM SUCCESS");
          print("  ═══════════════════════════════════════");
          print("  📦 Item: " + this.currentTargetItem);
          print("  🏷️  Category: " + itemData.category);
          print("  📍 Placement: " + itemData.placement);
          print("  ⭐ Priority: " + itemData.priority);
          print("  📊 Total items generated: " + this.generatedItems.length);
          print("  ═══════════════════════════════════════");
          
          return; // Success! Exit early
        } else {
          print("  ⚠️  AI response validation failed:");
          print("    - targetItem length: " + (itemData.targetItem?.length || 0));
          print("    - category present: " + (itemData.category ? "yes" : "no"));
          print("  → Using fallback generation");
        }
      } catch (parseError) {
        print("  ✗ JSON Parse Error: " + parseError);
        print("  → Failed JSON: " + jsonResponse.substring(0, 200));
        print("  → Using fallback generation");
      }
      
      // Only use fallback if AI generation truly failed
      this.generateFallbackSingleItem(roomData);
      
    } catch (error) {
      print("  ✗ AI API Error: " + error);
      print("  → Using fallback generation");
      this.generateFallbackSingleItem(roomData);
    }
  }

  private generateFallbackSingleItem(roomData: any) {
    const style = roomData.style || "contemporary";
    const colors = roomData.colors || "neutral";
    const roomType = roomData.roomType || "living space";
    const isOutdoor = roomData.environment === "outdoor";

    print("  ─────────────────────────────────────");
    print("  ⚠️  FALLBACK ITEM GENERATION");
    print("  ─────────────────────────────────────");

    // Create diverse fallback options based on room type and environment
    const indoorOptions = [
      `${style} accent chair with ${colors} upholstery and wooden legs, perfect for ${roomType} reading corner`,
      `${style} floor lamp with adjustable ${colors} shade, providing ambient lighting for ${roomType}`,
      `${style} wall art canvas with ${colors} abstract design, adding visual interest to ${roomType}`,
      `${style} side table with ${colors} finish and storage drawer, functional addition to ${roomType}`,
      `${style} decorative mirror with ${colors} frame, expanding perceived space in ${roomType}`,
      `${style} area rug with ${colors} geometric pattern, defining conversation area in ${roomType}`,
      `${style} bookshelf with ${colors} finish and multiple tiers, adding storage to ${roomType}`,
      `${style} throw pillows with ${colors} textured fabric, enhancing comfort in ${roomType}`,
      `${style} table lamp with ${colors} ceramic base, providing task lighting for ${roomType}`,
      `${style} wall shelf with ${colors} finish, displaying decor items in ${roomType}`
    ];

    const outdoorOptions = [
      `${style} outdoor lounge chair with weather-resistant ${colors} cushions for comfortable ${roomType} seating`,
      `${style} garden planter with ${colors} finish and drainage, adding greenery to ${roomType}`,
      `${style} outdoor string lights with ${colors} bulbs, creating ambiance in ${roomType}`,
      `${style} patio side table with ${colors} weatherproof finish for ${roomType} entertaining`,
      `${style} outdoor rug with ${colors} UV-resistant pattern, defining ${roomType} seating area`,
      `${style} garden sculpture with ${colors} finish, serving as focal point in ${roomType}`,
      `${style} outdoor floor lamp with ${colors} weather-resistant shade for ${roomType} lighting`,
      `${style} decorative outdoor cushions with ${colors} water-resistant fabric for ${roomType}`,
      `${style} garden bench with ${colors} finish, providing seating in ${roomType}`,
      `${style} outdoor wall art with ${colors} weatherproof coating for ${roomType} decoration`
    ];

    const options = isOutdoor ? outdoorOptions : indoorOptions;
    
    // Use a more intelligent selection based on previous items
    // This ensures we cycle through ALL options before repeating
    const usedIndices = this.generatedItems.map(item => {
      const match = item.match(/fallback_(\d+)/);
      return match ? parseInt(match[1]) : -1;
    }).filter(idx => idx >= 0);
    
    let selectedIndex = 0;
    for (let i = 0; i < options.length; i++) {
      if (!usedIndices.includes(i)) {
        selectedIndex = i;
        break;
      }
    }
    
    // If all have been used, start over with next sequential
    if (usedIndices.length >= options.length) {
      selectedIndex = usedIndices.length % options.length;
    }
    
    this.currentTargetItem = options[selectedIndex];
    
    // Track which fallback was used
    this.generatedItems.push(`fallback_${selectedIndex}`);
    if (this.generatedItems.length > 6) {
      this.generatedItems.shift();
    }
    
    print("  Environment: " + (isOutdoor ? "outdoor" : "indoor"));
    print("  Fallback index: " + selectedIndex + "/" + (options.length - 1));
    print("  📦 Item: " + this.currentTargetItem.substring(0, 80) + "...");
    print("  ─────────────────────────────────────");
  }

  private sendDataTo3DGenerator() {
    if (!this.snap3DGenerator?.api) {
      print("⚠️  3D Generator reference not set");
      return;
    }

    const analysisData = {
      targetItem: this.currentTargetItem,
      roomType: this.currentRoomType,
      style: this.currentStyle,
      colors: this.currentColors,
      layout: this.currentLayout,
      suggestions: this.currentSuggestions,
      analysis: this.currentAnalysis,
      environment: this.currentEnvironment,
      generatedItems: this.generatedItems,
      productInfo: this.currentProductInfo
    };
    
    print("\n🚀 SENDING DATA TO 3D GENERATOR");
    print("  Target Item: " + this.currentTargetItem.substring(0, 60) + "...");
    print("  Room Type: " + this.currentRoomType);
    print("  Style: " + this.currentStyle);
    print("  Environment: " + this.currentEnvironment);
    
    const methods = ['triggerSingleItemGeneration', 'generateSingleItem', 'autoGenerateSingleItem'];
    
    for (const method of methods) {
      if (this.snap3DGenerator.api[method]) {
        this.snap3DGenerator.api[method](analysisData);
        print("  ✓ Single 3D item generation triggered via: " + method);
        print("═══════════════════════════════════════\n");
        return;
      }
    }
     
    if (this.snap3DFactory?.api) {
      if (this.snap3DFactory.api.receiveSingleItemRequest) {
        this.snap3DFactory.api.receiveSingleItemRequest(analysisData);
        print("  ✓ Single item request sent to 3D factory");
        print("═══════════════════════════════════════\n");
        return;
      }
    }
        
    print("  ✗ No compatible single item 3D generation method found");
    print("═══════════════════════════════════════\n");
  }

  private generateVoiceFromText(textContent: string) {
    if (!textContent?.trim()) return;

    OpenAI.speech({
      model: "gpt-4o-mini-tts",
      input: textContent,
      voice: "coral",
      instructions: this.voiceGenerationInstructions,
    })
      .then((response) => {
        const aud = this.sceneObject.createComponent("AudioComponent");
        aud.audioTrack = response;
        aud.play(1);
      })
      .catch((error) => print("Voice generation error: " + error));
  }

  doSpeechGeneration() {
    if (this.textOutput?.text?.trim()) {
      this.generateVoiceFromText(this.textOutput.text);
    }
  }

  private async analyzeRoomComprehensively(base64Image: string): Promise<any> {
    try {
      const response = await OpenAI.chatCompletions({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Analyze this space and return ONLY valid JSON with no markdown:

            {
              "layout": "brief layout description",
              "roomType": "specific room/space type",
              "style": "observed style",
              "colors": "observed colors",
              "suggestions": "2-3 improvements",
              "environment": "indoor or outdoor"
            }

            Environment detection:
            - OUTDOOR: sky, trees, grass, patio, deck, garden
            - INDOOR: walls, ceiling, indoor furniture, rooms`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this space and detect environment:" },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
            ],
          },
        ],
      });

      let jsonResponse = response.choices[0].message.content?.trim() || "";
      
      // Clean markdown if present
      jsonResponse = jsonResponse.replace(/```json|```/g, '').trim();
      
      const startIdx = jsonResponse.indexOf('{');
      const endIdx = jsonResponse.lastIndexOf('}');
      if (startIdx !== -1 && endIdx !== -1) {
        jsonResponse = jsonResponse.substring(startIdx, endIdx + 1);
      }
      
      try {
        const parsedData = JSON.parse(jsonResponse);
        print("✓ Room analysis parsed successfully");
        return parsedData;
      } catch (parseError) {
        print("⚠️  Room analysis parse failed, using fallback");
        return this.createFallbackAnalysis(jsonResponse);
      }
    } catch (error) {
      print("✗ Room analysis API error: " + error);
      return this.createFallbackAnalysis("");
    }
  }

  private createFallbackAnalysis(responseText: string): any {
    const isOutdoor = /outdoor|garden|patio|deck|sky|trees|grass/i.test(responseText);
    
    return {
      layout: "Standard layout",
      roomType: isOutdoor ? "outdoor_space" : "living_room",
      style: "contemporary",
      colors: "neutral_tones",
      suggestions: "Add contextual improvements",
      environment: isOutdoor ? "outdoor" : "indoor"
    };
  }

  private async analyzeInteriorDesign(base64Image: string): Promise<string> {
    try {
      const response = await OpenAI.chatCompletions({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a helpful AI interior designer. Reply with detected style and 2-3 short improvements. Keep under 40 words, mention room type in suggestions.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: this.textInput.text || this.interiorDesignPrompt },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
            ],
          },
        ],
      });

      return response.choices[0].message.content?.trim() || "";
    } catch (error) {
      return "";
    }
  }

  private async generateDecorImage(prompt: string, base64Image: string) {
    try {
      const enhancedPromptResponse = await OpenAI.chatCompletions({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Create a detailed DALL-E prompt to redesign this room keeping same layout and structure. Focus on colors, textures, lighting, decorative elements. Start with 'Interior design of'.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: `Create DALL-E prompt for: ${prompt}` },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
            ],
          },
        ],
      });

      const enhancedPrompt = enhancedPromptResponse.choices[0].message.content?.trim() || prompt;

      const response = await OpenAI.imagesGenerate({
        model: "dall-e-3",
        prompt: enhancedPrompt,
        n: 1,
        size: "1024x1024",
      });

      print("DALL-E image generated, processing response...");
      this.processImageResponse(response, this.generatedDecorImage);
      
    } catch (error) {
      print("DALL-E generation failed: " + error);
    }
  }

  private notifySpatialGallery(method: string) {
    try {
        const spatialObj = this.spatialGallery?.getSceneObject() as any
        if (spatialObj?.api?.[method]) {
            spatialObj.api[method]()
            print(`Called ${method} on spatial gallery`)
        } else {
            print(`Spatial gallery API method ${method} not found`)
        }
    } catch (error) {
        print(`Error calling spatial gallery: ${error}`)
    }
  }

  private processImageResponse(response: any, imageComponent: Image) {
      response.data.forEach((datum) => {
          if (datum.url) {
              const rsm = require("LensStudio:RemoteServiceModule") as RemoteServiceModule;
              const resource = rsm.makeResourceFromUrl(datum.url);
              this.rmm.loadResourceAsImageTexture(
                  resource,
                  (texture) => {
                      if (imageComponent) {
                          imageComponent.mainPass.baseTex = texture;
                          print("Texture loaded from URL, notifying spatial gallery...");
                          
                          this.notifySpatialGallery('notifyGeneratedImageUpdated')
                      }
                  },
                  () => print("Failed to load image from URL")
              );
          } else if (datum.b64_json) {
              Base64.decodeTextureAsync(
                  datum.b64_json,
                  (texture) => {
                      if (imageComponent) {
                          imageComponent.mainPass.baseTex = texture;
                          print("Texture loaded from base64, notifying spatial gallery...");
                          
                          this.notifySpatialGallery('notifyGeneratedImageUpdated')
                      }
                  },
                  () => print("Failed to decode image from base64")
              );
          }
      });
  }

  public getCurrentAnalysisData() {
    return {
      analysis: this.currentAnalysis,
      suggestions: this.currentSuggestions,
      layout: this.currentLayout,
      roomType: this.currentRoomType,
      style: this.currentStyle,
      colors: this.currentColors,
      environment: this.currentEnvironment,
      targetItem: this.currentTargetItem,
      generatedItems: this.generatedItems
    };
  }

  public getCurrentTargetItem() {
    return {
      targetItem: this.currentTargetItem,
      analysis: this.currentAnalysis,
      roomType: this.currentRoomType,
      style: this.currentStyle,
      colors: this.currentColors,
      environment: this.currentEnvironment
    };
  }

  public manualTriggerSingleItemGeneration() {
    if (this.currentTargetItem) {
      this.sendDataTo3DGenerator();
    }
  }

  private async searchShoppingItems() {
    if (!this.currentTargetItem) {
      print("No target item to search for");
      return;
    }

    this.shoppingInfoText.text = "Searching for matching products...";
    this.priceText.text = "";
    this.storeText.text = "";

    try {
      const productSearchQuery = await this.generateProductSearchQuery();
      
      if (productSearchQuery) {
        print("🛒 Searching for: " + productSearchQuery);
        
        const productData = await this.searchAndExtractProductInfo(productSearchQuery);
        
        if (productData) {
          this.displayProductInfo(productData);
          this.delayedCallback(0.5, () => this.generatePlaceholderProductImage());
        } else {
          this.shoppingInfoText.text = "No matching products found";
        }
      }
    } catch (error) {
      print("Shopping search error: " + error);
      this.shoppingInfoText.text = "Search error occurred";
    }
  }

  private async generateProductSearchQuery(): Promise<string> {
    try {
      const response = await OpenAI.chatCompletions({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Extract the core product type and key features for shopping search. Focus on the main item category and essential characteristics.

            Examples:
            - "Modern black leather accent chair with metal legs for contemporary living room" → "black leather accent chair modern"
            - "Minimalist white ceramic table lamp with brass accents for bedroom lighting" → "white ceramic table lamp minimalist"
            - "Scandinavian style oak wood coffee table with storage for living room" → "oak coffee table scandinavian storage"

            Return only the search-optimized product query (3-6 words maximum).`,
          },
          {
            role: "user",
            content: `Create search query for: ${this.currentTargetItem}`,
          },
        ],
      });

      return response.choices[0].message.content?.trim() || "";
    } catch (error) {
      print("Failed to generate search query: " + error);
      return this.extractBasicProductType();
    }
  }

  private extractBasicProductType(): string {
    const item = this.currentTargetItem.toLowerCase();
    
    if (item.includes('chair')) return 'accent chair';
    if (item.includes('lamp')) return 'table lamp';
    if (item.includes('sofa')) return 'sofa';
    if (item.includes('table')) return 'coffee table';
    if (item.includes('plant')) return 'plant pot';
    if (item.includes('art') || item.includes('painting')) return 'wall art';
    if (item.includes('mirror')) return 'wall mirror';
    if (item.includes('rug')) return 'area rug';
    if (item.includes('shelf')) return 'wall shelf';
    if (item.includes('cushion')) return 'throw pillow';
    
    return 'home decor';
  }

  private async searchAndExtractProductInfo(searchQuery: string): Promise<any> {
    try {
      print("  Querying AI for product info: " + searchQuery);
      
      const response = await OpenAI.chatCompletions({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a product database assistant. Based on the search query, provide realistic product information.

            ALWAYS return valid JSON with this exact structure:
            {
              "name": "Product Name",
              "price": "€XX-XX or $XX-XX",
              "store": "Store Name",
              "description": "Brief description",
              "category": "furniture/lighting/decor"
            }

            Use realistic prices for European/American markets. Popular stores: IKEA, West Elm, CB2, Wayfair, Home Depot.`,
          },
          {
            role: "user",
            content: `Find product info for: ${searchQuery}`,
          },
        ],
      });

      const jsonResponse = response.choices[0].message.content?.trim() || "";
      
      let cleanJson = jsonResponse;
      if (cleanJson.includes('```json')) {
        cleanJson = cleanJson.split('```json')[1].split('```')[0];
      } else if (cleanJson.includes('```')) {
        cleanJson = cleanJson.split('```')[1].split('```')[0];
      }
      cleanJson = cleanJson.trim();
      
      try {
        const productData = JSON.parse(cleanJson);
        
        if (productData.name && productData.price && productData.store) {
          print("  ✓ Product data parsed successfully");
          return productData;
        } else {
          print("  ⚠️  Missing required product fields");
          return this.createFallbackProductData(searchQuery);
        }
      } catch (parseError) {
        print("  ✗ Product JSON parse error: " + parseError);
        return this.createFallbackProductData(searchQuery);
      }
      
    } catch (error) {
      print("  ✗ Product search API error: " + error);
      return this.createFallbackProductData(searchQuery);
    }
  }

  private createFallbackProductData(searchQuery: string): any {
    const itemType = this.extractBasicProductType();
    const country = this.userLocation.country.toLowerCase();
    
    let storeData = { store: "IKEA Italia", currency: "€", delivery: "3-7 giorni", location: "Roma" };
    
    if (country.includes('italy')) {
      storeData = { store: "IKEA Italia", currency: "€", delivery: "3-7 giorni", location: "Roma" };
    } else if (country.includes('germany')) {
      storeData = { store: "IKEA Deutschland", currency: "€", delivery: "2-5 Tage", location: "Local store" };
    } else if (country.includes('france')) {
      storeData = { store: "IKEA France", currency: "€", delivery: "3-6 jours", location: "Magasin local" };
    } else if (country.includes('usa') || country.includes('united states')) {
      storeData = { store: "IKEA USA", currency: "$", delivery: "3-7 days", location: "Local store" };
    } else if (country.includes('uk') || country.includes('britain')) {
      storeData = { store: "IKEA UK", currency: "£", delivery: "2-5 days", location: "Local store" };
    }

    const fallbackData = {
      chair: { name: "POÄNG Armchair", basePrice: "79-99" },
      lamp: { name: "FOTO Table Lamp", basePrice: "25-35" },
      sofa: { name: "KLIPPAN Loveseat", basePrice: "179-249" },
      table: { name: "HEMNES Coffee Table", basePrice: "129-159" },
      plant: { name: "FEJKA Artificial Plant", basePrice: "12-25" },
      art: { name: "BJÖRKSTA Picture Frame", basePrice: "15-30" },
      mirror: { name: "LOTS Mirror Set", basePrice: "39-49" },
      rug: { name: "STOENSE Rug", basePrice: "69-149" },
      shelf: { name: "LACK Wall Shelf", basePrice: "8-15" },
      pillow: { name: "GURLI Cushion Cover", basePrice: "4-8" }
    };

    const key = itemType.replace(' ', '').replace('accent', '').replace('table', '').replace('wall', '').replace('area', '').replace('throw', '').toLowerCase();
    const fallback = fallbackData[key] || fallbackData.chair;
    
    return {
      name: fallback.name,
      price: `${storeData.currency}${fallback.basePrice}`,
      store: storeData.store,
      description: `${this.currentStyle || 'Contemporary'} ${itemType} matching your room's aesthetic`,
      category: itemType,
      location: storeData.location,
      distance: storeData.delivery
    };
  }

  private displayProductInfo(productData: any) {
    this.currentProductInfo = {
      name: productData.name || "Product",
      price: productData.price || "Price unavailable",
      store: productData.store || "Furniture Store",
      imageUrl: productData.imageUrl || "",
      description: productData.description || "",
      location: productData.location || this.userLocation.city || "Local area",
      distance: productData.distance || productData.availability || "Available for delivery"
    };

    this.shoppingInfoText.text = `${this.currentProductInfo.name}`;
    this.priceText.text = `${this.currentProductInfo.price}`;
    this.storeText.text = `${this.currentProductInfo.store}`;
    
    if (this.locationText) {
      this.locationText.text = `📍 ${this.currentProductInfo.location} • ${this.currentProductInfo.distance}`;
    }

    print("  ✓ Product Info Displayed:");
    print("    Name: " + this.currentProductInfo.name);
    print("    Price: " + this.currentProductInfo.price);
    print("    Store: " + this.currentProductInfo.store);
  }

  private async generatePlaceholderProductImage() {
    try {
      if (!this.shoppingResultImage) {
        print("Shopping result image component not assigned");
        return;
      }

      const productName = this.currentProductInfo.name || "furniture item";
      const store = this.currentProductInfo.store || "furniture store";
      
      const productImagePrompt = `Professional product photography of ${productName}, clean white studio background, high quality commercial photo, well-lit, detailed view, ${store} style furniture catalog image`;

      print("🖼️  Generating product image...");

      const response = await OpenAI.imagesGenerate({
        model: "dall-e-3",
        prompt: productImagePrompt,
        n: 1,
        size: "1024x1024",
      });

      this.shoppingResultImage.enabled = true;
      this.shoppingResultImage.sceneObject.enabled = true;
      
      this.processImageResponse(response, this.shoppingResultImage);
      
    } catch (error) {
      print("Product image generation failed: " + error);
      
      if (this.shoppingResultImage) {
        this.shoppingResultImage.enabled = true;
        this.shoppingResultImage.sceneObject.enabled = true;
      }
    }
  }

  public searchForCurrentItem() {
    if (this.currentTargetItem) {
      this.searchShoppingItems();
    }
  }

  public getCurrentProductInfo() {
    return this.currentProductInfo;
  }

  public resetGeneratedItemsHistory() {
    this.generatedItems = [];
    print("Generated items history cleared");
  }

  public searchForCurrentItemWithLocation() {
    if (this.currentTargetItem) {
      if (this.useLocationSearch && !this.userLocation.city) {
        this.requestUserLocation();
        this.delayedCallback(2.0, () => this.searchShoppingItems());
      } else {
        this.searchShoppingItems();
      }
    }
  }

  public toggleLocationBasedSearch(enabled: boolean) {
    this.useLocationSearch = enabled;
    if (enabled && !this.userLocation.city) {
      this.requestUserLocation();
    }
    print(`Location-based shopping search ${enabled ? 'enabled' : 'disabled'}`);
  }

  public getUserLocation() {
    return this.userLocation;
  }

  private delayedCallback(delayTime: number, callback: () => void) {
    const delayedCallbackEvent = this.createEvent("DelayedCallbackEvent");
    delayedCallbackEvent.bind(callback);
    delayedCallbackEvent.reset(delayTime);
  }

  private encodeTextureToBase64(texture: Texture): Promise<string> {
    return new Promise((resolve, reject) => {
      Base64.encodeTextureAsync(texture, resolve, reject, CompressionQuality.LowQuality, EncodingType.Jpg);
    });
  }

  doChatCompletions() {
    this.textDisplay.sceneObject.enabled = true;
    this.textDisplay.text = "Generating...";
    OpenAI.chatCompletions({
      model: "gpt-4.1-nano",
      messages: [
        { role: "system", content: this.systemPrompt },
        { role: "user", content: this.userPrompt },
      ],
      temperature: 0.7,
    })
      .then((response) => {
        this.textDisplay.text = response.choices[0].message.content;
      })
      .catch((error) => {
        this.textDisplay.text = "Error: " + error;
      });
  }

  doImageGeneration() {
    this.imgObject.enabled = true;
    OpenAI.imagesGenerate({
      model: "dall-e-2",
      prompt: this.imageGenerationPrompt,
      n: 1,
      size: "512x512",
    })
      .then((response) => {
        this.processImageResponse(response, this.imgObject.getComponent("Image"));
      })
      .catch((error) => {
        print("Error: " + error);
      });
  }

  doFunctionCalling() {
    this.textDisplay.sceneObject.enabled = true;
    this.textDisplay.text = "Processing function call...";

    const tools: OpenAITypes.Common.Tool[] = [
      {
        type: "function",
        function: {
          name: "set-text-color",
          description: "Set the color of the text display",
          parameters: {
            type: "object",
            properties: {
              r: { type: "number", description: "Red component (0-255)" },
              g: { type: "number", description: "Green component (0-255)" },
              b: { type: "number", description: "Blue component (0-255)" },
            },
            required: ["r", "g", "b"],
          },
        },
      },
    ];

    OpenAI.chatCompletions({
      model: "gpt-4.1-nano",
      messages: [{ role: "user", content: this.functionCallingPrompt }],
      tools: tools,
      tool_choice: "auto",
      temperature: 0.7,
    })
      .then((response) => {
        const message = response.choices[0].message;
        if (message.tool_calls?.[0]?.function.name === "set-text-color") {
          const args = JSON.parse(message.tool_calls[0].function.arguments);
          this.textDisplay.textFill.color = new vec4(args.r/255, args.g/255, args.b/255, 1);
          this.textDisplay.text = `Text color set to RGB(${args.r}, ${args.g}, ${args.b})`;
        }
      })
      .catch((error) => {
        this.textDisplay.text = "Error: " + error;
      });
  }
}