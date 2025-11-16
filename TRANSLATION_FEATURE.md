# Indian Language Translation Feature

## Overview

The ISL Translator now supports automatic translation from any Indian language to English using Claude Sonnet 4.5 API before converting to Indian Sign Language.

## Setup Instructions

### 1. Get Your Claude API Key

1. Visit: https://console.anthropic.com/
2. Sign up or log in to your account
3. Navigate to **API Keys** section
4. Click **Create Key**
5. Copy your API key (starts with `sk-ant-`)

### 2. Configure the API Key in the App

1. Open `word_mapping_comparison.html` in your browser
2. Look for the **⚙️ Translation Settings** card in the control panel
3. Paste your Claude API key in the **Claude API Key** field
4. Click **Save API Key**
5. You should see: **✓ API key configured**

> **Note:** Your API key is stored securely in your browser's localStorage and never shared with anyone.

## How to Use

### Basic Usage

1. **Enable Auto-Translation** (enabled by default)
   - Check the checkbox: ☑ Auto-translate Indian languages to English

2. **Type in Any Indian Language**
   - Hindi: `नमस्ते, आप कैसे हैं?`
   - Bengali: `আপনি কেমন আছেন?`
   - Tamil: `நீங்கள் எப்படி இருக்கிறீர்கள்?`
   - Telugu: `మీరు ఎలా ఉన్నారు?`
   - Or any other Indian language

3. **Click "Convert to ISL"**
   - The app will automatically detect the language
   - Translate it to English using Claude AI
   - Show the translation: `✓ Translated: "How are you?"`
   - Convert the English text to ISL signs

### Supported Languages

The feature automatically detects and translates:

- **Devanagari**: Hindi, Marathi, Sanskrit, Nepali
- **Bengali/Assamese**: Bengali, Assamese
- **Tamil**: Tamil
- **Telugu**: Telugu
- **Kannada**: Kannada
- **Malayalam**: Malayalam
- **Gujarati**: Gujarati
- **Punjabi**: Punjabi (Gurmukhi script)
- **Oriya**: Oriya
- **Urdu**: Urdu (Arabic script)

If you type in English, it skips translation and directly converts to ISL.

## Features

### 1. Automatic Language Detection
- No need to select the language manually
- Uses Unicode character ranges to detect Indian scripts

### 2. Real-time Translation Status
- Shows **🔄 Translating...** while processing
- Displays **✓ Translated: "result"** when complete
- Shows **❌ Translation error** if something goes wrong

### 3. Fallback Handling
- If translation fails, the app will still try to process the original text
- Error messages are displayed but don't block the conversion

### 4. API Key Management
- **Save**: Stores the API key in browser localStorage
- **Clear**: Removes the API key from storage
- Status indicator shows if key is configured

## Example Workflow

```
1. User types: "मैं स्कूल जा रहा हूं"
2. App detects: Hindi (Devanagari script)
3. Translates via Claude: "I am going to school"
4. Status shows: ✓ Translated: "I am going to school"
5. Converts to ISL glosses: ["I", "SCHOOL", "GO"]
6. Displays the sign language real world emulation
```

## API Usage & Costs

- Uses **Claude Sonnet 4.5** (latest model)
- Costs approximately $0.003 per translation (very low)
- Each translation typically uses ~50-100 tokens
- See pricing: https://www.anthropic.com/pricing

## Troubleshooting

### "API key not configured" error
- Make sure you've pasted the API key and clicked "Save API Key"
- Check that the status shows "✓ API key configured"

### Translation not working
- Verify your API key is valid
- Check your internet connection
- Open browser console (F12) to see detailed error messages
- Make sure you have API credits in your Anthropic account

### Translation is slow
- First request may take 2-3 seconds (API cold start)
- Subsequent requests are usually faster (<1 second)

### Text not being translated
- Make sure "Auto-translate Indian languages to English" is checked
- Verify the text contains Indian language characters
- English text will skip translation automatically

## Privacy & Security

- ✅ API key is stored locally in your browser
- ✅ Never shared with any third party
- ✅ Only sent to Anthropic's API servers
- ✅ Translation requests are processed securely over HTTPS
- ✅ No data is logged or stored on our servers

## Advanced Features

### Disable Auto-Translation
Uncheck the "Auto-translate Indian languages to English" checkbox to disable automatic translation.

### Manual Translation
Even with auto-translate disabled, you can still type Indian languages and manually click "Convert" - the app will process it as-is.

### Voice Input + Translation
1. Click the 🎙 Speak button
2. Speak in any Indian language
3. The app transcribes → translates → converts to ISL automatically

## Technical Details

- **Model**: Claude Sonnet 4.5 (`claude-sonnet-4-20250514`)
- **Max tokens**: 1024
- **API Version**: 2023-06-01
- **Endpoint**: https://api.anthropic.com/v1/messages
- **Language Detection**: Unicode character ranges
- **Storage**: Browser localStorage

## Updates

### Version 2.0 (Current)
- ✨ Added Indian language translation support
- ✨ API key management interface
- ✨ Auto-detection of 10+ Indian scripts
- ✨ Real-time translation status
- ✨ Fallback handling for translation errors

---

**Need Help?** Check the browser console (F12) for detailed error messages and debugging information.

