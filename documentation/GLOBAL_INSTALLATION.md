# Global Extension Installation Guide

This guide explains how to install Content Safety Lock as a **global extension** so it cannot be removed or disabled by regular users.

## What is a Global Extension?

A global extension is installed at the system or user level (outside individual Firefox profiles) and:
- ✅ Applies to **all Firefox profiles** on the machine
- ✅ Cannot be uninstalled through the Firefox UI
- ✅ Cannot be disabled through the Firefox UI
- ✅ Persists across Firefox updates
- ✅ Requires administrator/system access to remove

## Installation Methods

### Method 1: System-Wide Global Extension (All Users)

**Platform: macOS**

#### Option A: Without npm (Simplest)

1. **Create XPI file manually**:
   ```bash
   cd /Users/dan/CascadeProjects/windsurf-project
   
   # Create a ZIP file with all extension files
   zip content_safety_lock-1.0.0.xpi \
     manifest.json \
     background.js \
     content.js \
     utils.js \
     options.html \
     options.js \
     popup.html \
     popup.js
   
   # Add icons directory
   zip -r content_safety_lock-1.0.0.xpi icons/
   
   # Verify structure
   unzip -l content_safety_lock-1.0.0.xpi
   ```

2. **Sign the extension** (required for global installation):
   
   For global extensions, you need to self-sign. Use `web-ext` to sign:
   
   ```bash
   # Install web-ext if you don't have it
   npm install --global web-ext
   
   # Get API credentials from Mozilla
   # 1. Go to: https://addons.mozilla.org/developers/
   # 2. Sign in or create account
   # 3. Go to Settings → API Keys
   # 4. Generate new credentials
   # 5. Copy the JWT Issuer and JWT Secret
   
   # Sign the extension
   web-ext sign \
     --api-key=YOUR_JWT_ISSUER \
     --api-secret=YOUR_JWT_SECRET \
     --source-dir=/Users/dan/CascadeProjects/windsurf-project
   
   # This creates a signed XPI in web-ext-artifacts/
   ```
   
   **Alternative: If you don't want to use web-ext**, you can:
   - Use the unsigned XPI directly in a global directory
   - Firefox will accept it if it's in the system extensions folder
   - See "Method 2: Unsigned Installation" below

#### Option B: With npm (Advanced)

1. **Build the extension**:
   ```bash
   cd /Users/dan/CascadeProjects/windsurf-project
   npm install --global web-ext
   web-ext build
   # Creates: web-ext-artifacts/content_safety_lock-1.0.0.zip
   ```

2. **Rename to XPI format**:
   ```bash
   mv web-ext-artifacts/content_safety_lock-1.0.0.zip \
      content_safety_lock-1.0.0.xpi
   ```

3. **Create global extensions directory** (if it doesn't exist):
   ```bash
   sudo mkdir -p /Library/Application\ Support/Mozilla/Extensions/{ec8030f7-c20a-464f-9b0e-13a3a9e97384}
   ```

4. **Copy extension to global directory**:
   ```bash
   sudo cp content_safety_lock-1.0.0.xpi \
      /Library/Application\ Support/Mozilla/Extensions/{ec8030f7-c20a-464f-9b0e-13a3a9e97384}/
   ```

5. **Verify installation**:
   - Restart Firefox completely
   - Go to `about:addons`
   - Extension should appear as "installed by your administrator"

---

## Method 2: Unsigned Installation (No Signing Required)

For global extensions in system directories, Firefox accepts unsigned XPIs. This is the **easiest method** if you don't want to sign through Mozilla.

**Platform: macOS**

1. **Create XPI file** (same as Method 1, step 1):
   ```bash
   cd /Users/dan/CascadeProjects/windsurf-project
   
   zip content_safety_lock-1.0.0.xpi \
     manifest.json \
     background.js \
     content.js \
     utils.js \
     options.html \
     options.js \
     popup.html \
     popup.js
   
   zip -r content_safety_lock-1.0.0.xpi icons/
   ```

2. **Create global extensions directory**:
   ```bash
   sudo mkdir -p /Library/Application\ Support/Mozilla/Extensions/{ec8030f7-c20a-464f-9b0e-13a3a9e97384}
   ```

3. **Copy unsigned XPI to global directory**:
   ```bash
   sudo cp content_safety_lock-1.0.0.xpi \
      /Library/Application\ Support/Mozilla/Extensions/{ec8030f7-c20a-464f-9b0e-13a3a9e97384}/
   ```

4. **Restart Firefox completely** (close all windows)

5. **Verify**:
   - Go to `about:addons`
   - Extension should appear (may show warning about unsigned, but will work)

**Why this works**: Firefox allows unsigned extensions in system-level directories for administrative purposes.

---

**Platform: Windows**

1. **Build the extension** (same as above)

2. **Create global extensions directory**:
   ```powershell
   New-Item -ItemType Directory -Force -Path "C:\Program Files\Mozilla Firefox\browser\extensions"
   ```

3. **Copy extension**:
   ```powershell
   Copy-Item "content_safety_lock-1.0.0.xpi" `
      "C:\Program Files\Mozilla Firefox\browser\extensions\"
   ```

4. **Restart Firefox** - extension will be installed

**Platform: Linux**

1. **Build the extension** (same as above)

2. **Create global extensions directory**:
   ```bash
   sudo mkdir -p /usr/lib/firefox/browser/extensions
   # or for Snap: /snap/firefox/current/usr/lib/firefox/browser/extensions
   ```

3. **Copy extension**:
   ```bash
   sudo cp content_safety_lock-1.0.0.xpi \
      /usr/lib/firefox/browser/extensions/
   ```

4. **Restart Firefox**

---

### Method 2: User-Level Global Extension (Current User Only)

**Platform: macOS**

1. **Build the extension**:
   ```bash
   web-ext build
   mv web-ext-artifacts/content_safety_lock-1.0.0.zip \
      content_safety_lock-1.0.0.xpi
   ```

2. **Create user extensions directory**:
   ```bash
   mkdir -p ~/Library/Application\ Support/Mozilla/Extensions/{ec8030f7-c20a-464f-9b0e-13a3a9e97384}
   ```

3. **Copy extension**:
   ```bash
   cp content_safety_lock-1.0.0.xpi \
      ~/Library/Application\ Support/Mozilla/Extensions/{ec8030f7-c20a-464f-9b0e-13a3a9e97384}/
   ```

4. **Restart Firefox**

**Platform: Windows**

1. **Build the extension**

2. **Create user extensions directory**:
   ```powershell
   New-Item -ItemType Directory -Force -Path "$env:APPDATA\Mozilla\Extensions\{ec8030f7-c20a-464f-9b0e-13a3a9e97384}"
   ```

3. **Copy extension**:
   ```powershell
   Copy-Item "content_safety_lock-1.0.0.xpi" `
      "$env:APPDATA\Mozilla\Extensions\{ec8030f7-c20a-464f-9b0e-13a3a9e97384}\"
   ```

4. **Restart Firefox**

**Platform: Linux**

1. **Build the extension**

2. **Create user extensions directory**:
   ```bash
   mkdir -p ~/.mozilla/extensions/{ec8030f7-c20a-464f-9b0e-13a3a9e97384}
   ```

3. **Copy extension**:
   ```bash
   cp content_safety_lock-1.0.0.xpi \
      ~/.mozilla/extensions/{ec8030f7-c20a-464f-9b0e-13a3a9e97384}/
   ```

4. **Restart Firefox**

---

### Method 3: Enterprise Deployment (Group Policy)

**Platform: Windows (Domain-Joined Computers)**

1. **Build the extension** and host on a web server:
   ```
   https://your-server.com/extensions/content_safety_lock-1.0.0.xpi
   ```

2. **Create Group Policy Object (GPO)**:
   - Open Group Policy Editor (`gpedit.msc`)
   - Navigate to: `Computer Configuration > Administrative Templates > Mozilla Firefox > Extensions`
   - Create new policy: "Install Extensions"
   - Set value: `https://your-server.com/extensions/content_safety_lock-1.0.0.xpi`

3. **Apply to users/computers** as needed

4. **Verify**: Users will see extension installed as "installed by your administrator"

---

## Important Notes

### Firefox GUID

The GUID `{ec8030f7-c20a-464f-9b0e-13a3a9e97384}` is Firefox's official ID. This is **not** your extension's ID - it's Firefox's ID. Always use this exact GUID.

### Extension ID

Your extension needs a unique ID. Update `manifest.json`:

```json
{
  "manifest_version": 3,
  "browser_specific_settings": {
    "gecko": {
      "id": "contentsafetylock@example.com"
    }
  }
}
```

### File Format

- Global extensions must be `.xpi` files (ZIP archives with specific structure)
- Use `web-ext build` to create properly formatted XPI files
- Do NOT use raw directories

### Permissions

- **System-wide installation**: Requires administrator/sudo access
- **User-level installation**: Requires user access to home directory
- **Enterprise deployment**: Requires Group Policy admin access

---

## Verification

### Check if Extension is Installed

1. **In Firefox**:
   - Go to `about:addons`
   - Look for "Content Safety Lock"
   - Should show "installed by your administrator"

2. **In Console**:
   - Open Developer Tools (F12)
   - Go to Console tab
   - Type: `browser.management.getAll()` (if permissions allow)

3. **Check File System**:
   ```bash
   # macOS/Linux
   ls -la ~/Library/Application\ Support/Mozilla/Extensions/{ec8030f7-c20a-464f-9b0e-13a3a9e97384}/
   
   # Windows
   dir "%APPDATA%\Mozilla\Extensions\{ec8030f7-c20a-464f-9b0e-13a3a9e97384}\"
   ```

---

## Removal

### Remove Global Extension

**macOS (System-wide)**:
```bash
sudo rm /Library/Application\ Support/Mozilla/Extensions/{ec8030f7-c20a-464f-9b0e-13a3a9e97384}/content_safety_lock-1.0.0.xpi
```

**macOS (User-level)**:
```bash
rm ~/Library/Application\ Support/Mozilla/Extensions/{ec8030f7-c20a-464f-9b0e-13a3a9e97384}/content_safety_lock-1.0.0.xpi
```

**Windows (System-wide)**:
```powershell
Remove-Item "C:\Program Files\Mozilla Firefox\browser\extensions\content_safety_lock-1.0.0.xpi"
```

**Windows (User-level)**:
```powershell
Remove-Item "$env:APPDATA\Mozilla\Extensions\{ec8030f7-c20a-464f-9b0e-13a3a9e97384}\content_safety_lock-1.0.0.xpi"
```

**Linux**:
```bash
sudo rm /usr/lib/firefox/browser/extensions/content_safety_lock-1.0.0.xpi
```

---

## Troubleshooting

### Extension Not Appearing

1. **Check file location**: Verify XPI is in correct directory
2. **Check file permissions**: Ensure readable by Firefox process
3. **Check file format**: Must be `.xpi` (ZIP archive)
4. **Restart Firefox**: Close all Firefox windows and restart
5. **Check Firefox version**: Extension must be compatible

### "Installed by Administrator" Not Showing

- Verify file is in global extensions directory (not profile directory)
- Restart Firefox completely
- Check Firefox console for errors

### Users Can Still Disable/Remove

- Verify extension is in **global** directory, not profile directory
- Profile-level extensions can always be disabled by users
- Only true global extensions prevent this

---

## Security Considerations

### Advantages of Global Installation

✅ Prevents accidental uninstall
✅ Applies to all profiles automatically
✅ Survives Firefox updates
✅ Centralized management

### Disadvantages

⚠️ Requires admin access to install/remove
⚠️ Affects all Firefox profiles
⚠️ Users cannot customize per-profile
⚠️ May trigger security warnings

### Best Practices

1. **Inform users**: Clearly communicate why extension is installed
2. **Provide support**: Have support channel for issues
3. **Update regularly**: Keep extension updated for security
4. **Monitor usage**: Track if extension is working as intended
5. **Document process**: Keep installation procedure documented

---

## Advanced: Locking Down Further

### Prevent Uninstall via Firefox Policies

Create `policies.json` in Firefox installation directory:

**macOS**:
```bash
/Applications/Firefox.app/Contents/Resources/distribution/policies.json
```

**Windows**:
```
C:\Program Files\Mozilla Firefox\distribution\policies.json
```

**Content**:
```json
{
  "policies": {
    "Extensions": {
      "Locked": ["contentsafetylock@example.com"]
    }
  }
}
```

This prevents users from disabling the extension even in the UI.

---

## Quick Start Script

### macOS/Linux

```bash
#!/bin/bash

# Build extension
cd /Users/dan/CascadeProjects/windsurf-project
web-ext build

# Convert to XPI
mv web-ext-artifacts/content_safety_lock-1.0.0.zip \
   content_safety_lock-1.0.0.xpi

# Create global directory
sudo mkdir -p /Library/Application\ Support/Mozilla/Extensions/{ec8030f7-c20a-464f-9b0e-13a3a9e97384}

# Install globally
sudo cp content_safety_lock-1.0.0.xpi \
   /Library/Application\ Support/Mozilla/Extensions/{ec8030f7-c20a-464f-9b0e-13a3a9e97384}/

echo "Extension installed globally!"
echo "Restart Firefox to activate."
```

### Windows PowerShell

```powershell
# Build extension
cd C:\Users\dan\CascadeProjects\windsurf-project
web-ext build

# Convert to XPI
Rename-Item -Path "web-ext-artifacts\content_safety_lock-1.0.0.zip" `
            -NewName "content_safety_lock-1.0.0.xpi"

# Create global directory
New-Item -ItemType Directory -Force -Path "C:\Program Files\Mozilla Firefox\browser\extensions"

# Install globally
Copy-Item "content_safety_lock-1.0.0.xpi" `
          "C:\Program Files\Mozilla Firefox\browser\extensions\"

Write-Host "Extension installed globally!"
Write-Host "Restart Firefox to activate."
```

---

## References

- [Mozilla Global Extensions Documentation](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Alternative_distribution_options/Sideloading_add-ons)
- [Firefox Policies Documentation](https://github.com/mozilla/policy-templates)
- [MozillaZine Uninstalling Add-ons](https://kb.mozillazine.org/Uninstalling_add-ons#Global_extension)

---

**Last Updated**: October 21, 2025
**Version**: 1.0.0

For questions or issues, refer to the main README.md or DEPLOYMENT.md.
