
# UIT Media FrameFusion Photobooth

## Description

UIT Media FrameFusion is an elegant, powerful, and highly customizable web-based photobooth application. Designed for professional event workflows, it bridges the gap between complex photo editing and seamless guest experiences. Operators can upload custom-branded frames, design intricate photo layouts, and capture images via webcam or professional tethering workflows.

The application features a synchronized dual-window interface: an **Operator Console** for control and design, and a **Guest Window** for live previews, countdowns, and QR code delivery.

## Key Features

-   **Custom Frame Upload**: Support for transparent PNG overlays with Portrait and Landscape orientation toggles.
-   **Advanced Layout Designer**:
    -   **Dual Template Support**: Design two separate layouts (Template A & B) and merge them into a single export (perfect for photo strips).
    -   **Precision Tools**: Snap-to-grid guides, alignment buttons (center, top, distribute), and aspect ratio locking.
    -   **Presets & History**: Use built-in presets (Strips, 2x2, etc.), save your own custom layouts, and use Undo/Redo for peace of mind.
-   **Multiple Capture Modes**:
    -   **Tethered "Hot Folder"**: Automatically pull images from professional software like Capture One.
    -   **Webcam**: Built-in camera support with live preview.
    -   **Manual Import**: Drag-and-drop interface for loading existing photos.
-   **Creative Suite**:
    -   **Decorations**: Add custom **Stickers** and rich **Text** layers to the final photo.
    -   **AI Editing**: Integrated Google Gemini API allows operators to edit photos using natural language prompts (e.g., "Remove the background", "Make it vintage").
    -   **Photo Adjustments**: Individual pan, zoom, and rotation controls for every photo slot.
-   **Guest Experience**:
    -   **Live Tether Preview**: A specialized view helping guests pose within the frame boundaries before the shot is taken.
    -   **Live Mirroring**: Real-time reflection of operator adjustments on the guest screen.
    -   **QR Code Delivery**: Instant, touchless sharing via generated QR codes.
-   **Organizer Tools**:
    -   **Kiosk Mode**: Locks the interface for unattended or semi-attended operation.
    -   **Auto-Save**: Automatically saves high-resolution composites to a local directory.
    -   **UI Customization**: Complete control over the app's color palette, fonts, and branding assets.

---

## Operator's Manual

### Step 1: Initial Setup
1.  **Customize UI (Palette Icon 🎨)**: Open the side panel to upload your event Logo, Background Image, and configure the Color Scheme and Fonts to match the event branding.
2.  **Settings (Gear Icon ⚙️)**:
    -   **Hot Folder**: Select the folder where your camera writes images (for tethering).
    -   **Output Folder**: Select where the final photobooth strips will be saved.
    -   **File Naming**: Configure templates like `event-{number}`.

### Step 2: Upload Frame
1.  Upload a **Transparent PNG** frame.
2.  Use the **Landscape/Portrait** toggle to set the orientation.
3.  Adjust the frame zoom/position if necessary and confirm.

### Step 3: Design Layout
The Designer allows you to define where photos go.
1.  **Template Tabs (A/B)**: You can design two layouts simultaneously. Use the checkboxes at the bottom to decide if you want to export just one, or merge them (e.g., for printing two strips on one 4x6 paper).
2.  **Add Slots**: Open the "Add Slots" accordion to add freeform boxes or use **Presets** (like 2x2 Grid or Vertical Strips).
3.  **Position & Properties**: 
    -   Select slots (Hold Shift to multi-select).
    -   Use **Alignment** tools to center or distribute slots evenly.
    -   Use **Aspect Ratio** locks to ensure photos fit specific dimensions (e.g., Square, 4:3).
4.  **Save Layouts**: Save your design to LocalStorage for quick recall in future sessions.

### Step 4: Add Photos
1.  **Source**: Choose between **Start Camera** (Webcam), **Import** (Files), or **Use Hot Folder** (Tethering).
2.  **Place**: Drag photos from the sidebar tray into the slots on the canvas.
3.  **Adjust**: Scroll to zoom or drag to pan photos within their slots before finalizing. The Guest Window will update live as you pan.

### Step 5: Finalize & Export
1.  **Photo Adjust Tab**:
    -   Select specific photos to rotate or fine-tune crops.
    -   Use the **Edit with AI** box to apply generative edits.
2.  **Decorate Tab**:
    -   **Add Text**: Type messages, change fonts, and colors.
    -   **Stickers**: Upload custom PNG stickers or use the built-in library.
3.  **Global Controls**: Adjust the **Frame Transparency** or **Global Photo Scale**.
4.  **Delivery**:
    -   **Show QR Code**: Displays the code on the Guest Window.
    -   **Download/Print**: Save the file locally or send to a connected printer.

## Installation

1.  Clone the repository.
2.  Install dependencies: `npm install`.
3.  Set up environment variables (e.g., `API_KEY` for Gemini AI, `GOOGLE_CLIENT_ID` for Drive integration).
4.  Run the development server: `npm start`.
