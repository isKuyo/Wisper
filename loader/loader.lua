--[[
    WISPER HUB LOADER
    Version: 1.0.0
]]

-- Configuration
local CONFIG = {
    API_URL = "https://wisper-production-ecd0.up.railway.app/api",
    VERSION = "1.0.0",
    DEBUG = true
}

-- Services
local Players = game:GetService("Players")
local HttpService = game:GetService("HttpService")
local UserInputService = game:GetService("UserInputService")
local CoreGui = game:GetService("CoreGui")

local LocalPlayer = Players.LocalPlayer
local PlaceId = game.PlaceId

-- Console Utils (Inline Logger with Colors)
local console = nil
pcall(function()
    console = loadstring(game:HttpGet("https://raw.githubusercontent.com/notpoiu/Scripts/main/utils/console/main.lua"))()
end)

-- Colors
local COLORS = {
    INFO = Color3.fromRGB(148, 163, 184),
    SUCCESS = Color3.fromRGB(34, 197, 94),
    WARNING = Color3.fromRGB(251, 191, 36),
    ERROR = Color3.fromRGB(239, 68, 68),
    ACCENT = Color3.fromRGB(14, 165, 233),
}

-- Single inline logger that updates on the same line
local mainLogger = nil

-- Initialize the main logger
local function initLogger()
    if console and not mainLogger then
        mainLogger = console.custom_print("[Wisper Hub] Initializing...", "", COLORS.ACCENT)
    end
end

-- Update the single line logger
local function updateLog(message, color)
    color = color or COLORS.INFO
    if CONFIG.DEBUG then
        -- Try to use inline console first
        if console and mainLogger then
            local success = pcall(function()
                mainLogger.update_message("[Wisper Hub] " .. tostring(message), "", color, true)
            end)
            if success then return end
        end
        
        -- Fallback to print only if inline console failed
        print("[Wisper Hub] " .. tostring(message))
    end
end

-- Shortcut functions for different log types
local function logSuccess(message)
    updateLog("[OK] " .. message, COLORS.SUCCESS)
end

local function logWarning(message)
    updateLog("[!] " .. message, COLORS.WARNING)
end

local function logError(message)
    updateLog("[X] " .. message, COLORS.ERROR)
end

local function logInfo(message)
    updateLog("[*] " .. message, COLORS.INFO)
end

local function logAccent(message)
    updateLog("[+] " .. message, COLORS.ACCENT)
end

-- Progress bar on the same line
local function updateProgress(percent, message, color)
    color = color or COLORS.ACCENT
    local barLength = 10
    local filled = math.floor(percent / 100 * barLength)
    local empty = barLength - filled
    local bar = string.rep("#", filled) .. string.rep("-", empty)
    updateLog("[" .. bar .. "] " .. percent .. "% - " .. message, color)
end

-- Simple log function (creates new line - use sparingly)
local function log(message, color)
    color = color or COLORS.INFO
    if CONFIG.DEBUG then
        if console then
            return console.custom_print("[Wisper Hub] " .. tostring(message), "", color)
        else
            print("[Wisper Hub] " .. tostring(message))
        end
    end
    return nil
end

-- Key storage
local KEY_FILE_NAME = "wisper_hub_key.txt"

local function saveKey(key)
    pcall(function()
        if writefile then
            writefile(KEY_FILE_NAME, key)
        end
    end)
end

local function loadSavedKey()
    local success, result = pcall(function()
        if isfile and readfile then
            if isfile(KEY_FILE_NAME) then
                local key = readfile(KEY_FILE_NAME)
                if key and key:match("^WISPER%-%w%w%w%w%-%w%w%w%w%-%w%w%w%w%-%w%w%w%w$") then
                    return key
                end
            end
        end
        return nil
    end)
    return success and result or nil
end

local function deleteSavedKey()
    pcall(function()
        if delfile and isfile and isfile(KEY_FILE_NAME) then
            delfile(KEY_FILE_NAME)
        end
    end)
end

-- HWID Generation
local function generateHWID()
    local identifiers = {}
    table.insert(identifiers, tostring(LocalPlayer.UserId))
    table.insert(identifiers, tostring(PlaceId))
    
    pcall(function()
        if identifyexecutor then
            local name = identifyexecutor()
            table.insert(identifiers, name or "unknown")
        end
    end)
    
    pcall(function()
        if gethwid then
            table.insert(identifiers, gethwid())
        elseif get_hwid then
            table.insert(identifiers, get_hwid())
        end
    end)
    
    local combined = table.concat(identifiers, ":")
    local hash = 0
    for i = 1, #combined do
        hash = (hash * 31 + string.byte(combined, i)) % 2147483647
    end
    
    local hashStr = ""
    for i = 1, 4 do
        hash = (hash * 1103515245 + 12345) % 2147483647
        hashStr = hashStr .. string.format("%08x", hash % 0xFFFFFFFF)
    end
    
    return hashStr
end

-- Signature generation (no secret needed - server uses optional verification)
local function generateSignature(key, hwid, placeId, timestamp)
    local payload = (key or "") .. (hwid or "") .. tostring(placeId or "") .. tostring(timestamp)
    local hash = 0
    
    for i = 1, #payload do
        hash = (hash * 31 + string.byte(payload, i)) % 2147483647
    end
    
    local signature = ""
    for i = 1, 8 do
        hash = (hash * 1103515245 + 12345) % 2147483647
        signature = signature .. string.format("%08x", hash % 0xFFFFFFFF)
    end
    
    return signature
end

-- HTTP Request
local function httpRequest(endpoint, method, body, extraHeaders)
    local url = CONFIG.API_URL .. endpoint
    local headers = {
        ["Content-Type"] = "application/json"
    }
    
    if extraHeaders then
        for k, v in pairs(extraHeaders) do
            headers[k] = v
        end
    end
    
    if body then
        local timestamp = os.time() * 1000
        headers["X-Timestamp"] = tostring(timestamp)
        headers["X-Signature"] = generateSignature(body.key, body.hwid, body.placeId, timestamp)
    end
    
    local success, response = pcall(function()
        if syn and syn.request then
            return syn.request({
                Url = url,
                Method = method or "GET",
                Headers = headers,
                Body = body and HttpService:JSONEncode(body) or nil
            })
        elseif request then
            return request({
                Url = url,
                Method = method or "GET",
                Headers = headers,
                Body = body and HttpService:JSONEncode(body) or nil
            })
        elseif http_request then
            return http_request({
                Url = url,
                Method = method or "GET",
                Headers = headers,
                Body = body and HttpService:JSONEncode(body) or nil
            })
        else
            error("No HTTP request function available")
        end
    end)
    
    if not success then
        log("HTTP Error: " .. tostring(response))
        return nil, "Request failed"
    end
    
    if response.StatusCode ~= 200 then
        log("HTTP Status: " .. tostring(response.StatusCode))
        return nil, "Server error"
    end
    
    local data = HttpService:JSONDecode(response.Body)
    return data, nil
end

-- GUI Creation
local function createGUI()
    pcall(function()
        if CoreGui:FindFirstChild("WisperHub") then
            CoreGui:FindFirstChild("WisperHub"):Destroy()
        end
    end)
    
    local ScreenGui = Instance.new("ScreenGui")
    ScreenGui.Name = "WisperHub"
    ScreenGui.ResetOnSpawn = false
    
    pcall(function()
        if syn and syn.protect_gui then
            syn.protect_gui(ScreenGui)
        end
        ScreenGui.Parent = CoreGui
    end)
    
    if not ScreenGui.Parent then
        ScreenGui.Parent = LocalPlayer:WaitForChild("PlayerGui")
    end
    
    local MainFrame = Instance.new("Frame")
    MainFrame.Name = "MainFrame"
    MainFrame.Size = UDim2.new(0, 400, 0, 300)
    MainFrame.Position = UDim2.new(0.5, -200, 0.5, -150)
    MainFrame.BackgroundColor3 = Color3.fromRGB(15, 23, 42)
    MainFrame.BorderSizePixel = 0
    MainFrame.Parent = ScreenGui
    
    local MainCorner = Instance.new("UICorner")
    MainCorner.CornerRadius = UDim.new(0, 12)
    MainCorner.Parent = MainFrame
    
    local Header = Instance.new("Frame")
    Header.Name = "Header"
    Header.Size = UDim2.new(1, 0, 0, 50)
    Header.BackgroundColor3 = Color3.fromRGB(30, 41, 59)
    Header.BorderSizePixel = 0
    Header.Parent = MainFrame
    
    local HeaderCorner = Instance.new("UICorner")
    HeaderCorner.CornerRadius = UDim.new(0, 12)
    HeaderCorner.Parent = Header
    
    local Logo = Instance.new("TextLabel")
    Logo.Name = "Logo"
    Logo.Size = UDim2.new(0, 200, 1, 0)
    Logo.Position = UDim2.new(0, 15, 0, 0)
    Logo.BackgroundTransparency = 1
    Logo.Text = "Wisper Hub"
    Logo.TextColor3 = Color3.fromRGB(255, 255, 255)
    Logo.TextSize = 20
    Logo.Font = Enum.Font.GothamBold
    Logo.TextXAlignment = Enum.TextXAlignment.Left
    Logo.Parent = Header
    
    local CloseButton = Instance.new("TextButton")
    CloseButton.Name = "CloseButton"
    CloseButton.Size = UDim2.new(0, 30, 0, 30)
    CloseButton.Position = UDim2.new(1, -40, 0.5, -15)
    CloseButton.BackgroundColor3 = Color3.fromRGB(239, 68, 68)
    CloseButton.Text = "X"
    CloseButton.TextColor3 = Color3.fromRGB(255, 255, 255)
    CloseButton.TextSize = 16
    CloseButton.Font = Enum.Font.GothamBold
    CloseButton.Parent = Header
    
    local CloseCorner = Instance.new("UICorner")
    CloseCorner.CornerRadius = UDim.new(0, 6)
    CloseCorner.Parent = CloseButton
    
    CloseButton.MouseButton1Click:Connect(function()
        ScreenGui:Destroy()
    end)
    
    local Content = Instance.new("Frame")
    Content.Name = "Content"
    Content.Size = UDim2.new(1, -30, 1, -80)
    Content.Position = UDim2.new(0, 15, 0, 65)
    Content.BackgroundTransparency = 1
    Content.Parent = MainFrame
    
    local StatusLabel = Instance.new("TextLabel")
    StatusLabel.Name = "StatusLabel"
    StatusLabel.Size = UDim2.new(1, 0, 0, 20)
    StatusLabel.BackgroundTransparency = 1
    StatusLabel.Text = "Enter your key to continue"
    StatusLabel.TextColor3 = Color3.fromRGB(148, 163, 184)
    StatusLabel.TextSize = 14
    StatusLabel.Font = Enum.Font.Gotham
    StatusLabel.Parent = Content
    
    local KeyInput = Instance.new("TextBox")
    KeyInput.Name = "KeyInput"
    KeyInput.Size = UDim2.new(1, 0, 0, 45)
    KeyInput.Position = UDim2.new(0, 0, 0, 30)
    KeyInput.BackgroundColor3 = Color3.fromRGB(30, 41, 59)
    KeyInput.Text = ""
    KeyInput.PlaceholderText = "WISPER-XXXX-XXXX-XXXX-XXXX"
    KeyInput.PlaceholderColor3 = Color3.fromRGB(100, 116, 139)
    KeyInput.TextColor3 = Color3.fromRGB(255, 255, 255)
    KeyInput.TextSize = 16
    KeyInput.Font = Enum.Font.Code
    KeyInput.ClearTextOnFocus = false
    KeyInput.Parent = Content
    
    local KeyCorner = Instance.new("UICorner")
    KeyCorner.CornerRadius = UDim.new(0, 8)
    KeyCorner.Parent = KeyInput
    
    local ValidateButton = Instance.new("TextButton")
    ValidateButton.Name = "ValidateButton"
    ValidateButton.Size = UDim2.new(1, 0, 0, 45)
    ValidateButton.Position = UDim2.new(0, 0, 0, 85)
    ValidateButton.BackgroundColor3 = Color3.fromRGB(14, 165, 233)
    ValidateButton.Text = "Validate Key"
    ValidateButton.TextColor3 = Color3.fromRGB(255, 255, 255)
    ValidateButton.TextSize = 16
    ValidateButton.Font = Enum.Font.GothamBold
    ValidateButton.Parent = Content
    
    local ValidateCorner = Instance.new("UICorner")
    ValidateCorner.CornerRadius = UDim.new(0, 8)
    ValidateCorner.Parent = ValidateButton
    
    local GetKeyButton = Instance.new("TextButton")
    GetKeyButton.Name = "GetKeyButton"
    GetKeyButton.Size = UDim2.new(1, 0, 0, 35)
    GetKeyButton.Position = UDim2.new(0, 0, 0, 140)
    GetKeyButton.BackgroundColor3 = Color3.fromRGB(30, 41, 59)
    GetKeyButton.Text = "Get Key from Website"
    GetKeyButton.TextColor3 = Color3.fromRGB(148, 163, 184)
    GetKeyButton.TextSize = 14
    GetKeyButton.Font = Enum.Font.Gotham
    GetKeyButton.Parent = Content
    
    local GetKeyCorner = Instance.new("UICorner")
    GetKeyCorner.CornerRadius = UDim.new(0, 8)
    GetKeyCorner.Parent = GetKeyButton
    
    local GameInfo = Instance.new("TextLabel")
    GameInfo.Name = "GameInfo"
    GameInfo.Size = UDim2.new(1, 0, 0, 20)
    GameInfo.Position = UDim2.new(0, 0, 1, -20)
    GameInfo.BackgroundTransparency = 1
    GameInfo.Text = "Game: " .. tostring(PlaceId)
    GameInfo.TextColor3 = Color3.fromRGB(100, 116, 139)
    GameInfo.TextSize = 12
    GameInfo.Font = Enum.Font.Gotham
    GameInfo.Parent = Content
    
    -- Make draggable
    local dragging = false
    local dragStart, startPos
    
    Header.InputBegan:Connect(function(input)
        if input.UserInputType == Enum.UserInputType.MouseButton1 then
            dragging = true
            dragStart = input.Position
            startPos = MainFrame.Position
        end
    end)
    
    Header.InputEnded:Connect(function(input)
        if input.UserInputType == Enum.UserInputType.MouseButton1 then
            dragging = false
        end
    end)
    
    UserInputService.InputChanged:Connect(function(input)
        if dragging and input.UserInputType == Enum.UserInputType.MouseMovement then
            local delta = input.Position - dragStart
            MainFrame.Position = UDim2.new(
                startPos.X.Scale,
                startPos.X.Offset + delta.X,
                startPos.Y.Scale,
                startPos.Y.Offset + delta.Y
            )
        end
    end)
    
    return {
        ScreenGui = ScreenGui,
        MainFrame = MainFrame,
        StatusLabel = StatusLabel,
        KeyInput = KeyInput,
        ValidateButton = ValidateButton,
        GetKeyButton = GetKeyButton,
        GameInfo = GameInfo
    }
end

-- Status helpers
local function setStatus(gui, text, color)
    gui.StatusLabel.Text = text
    gui.StatusLabel.TextColor3 = color or Color3.fromRGB(148, 163, 184)
end

local function setButtonState(button, enabled, text)
    button.Text = text or button.Text
    button.BackgroundColor3 = enabled and Color3.fromRGB(14, 165, 233) or Color3.fromRGB(71, 85, 105)
    button.Active = enabled
end

-- Load script
local function loadScript(scriptUrl, scriptToken)
    
    local success, response = pcall(function()
        if syn and syn.request then
            return syn.request({
                Url = CONFIG.API_URL .. scriptUrl,
                Method = "GET",
                Headers = { ["Authorization"] = "Bearer " .. scriptToken }
            })
        elseif request then
            return request({
                Url = CONFIG.API_URL .. scriptUrl,
                Method = "GET",
                Headers = { ["Authorization"] = "Bearer " .. scriptToken }
            })
        end
    end)
    
    if not success or response.StatusCode ~= 200 then
        return nil, "Failed to load script"
    end
    
    local data = HttpService:JSONDecode(response.Body)
    
    if data.success and data.script then
        return data.script, nil
    end
    
    return nil, "Invalid script response"
end

-- Validate and execute
local function validateAndExecute(key, hwid, hubInfo, showStatus, isAutoValidate)
    local executorName = "Unknown"
    pcall(function()
        if identifyexecutor then
            local name, version = identifyexecutor()
            executorName = name or "Unknown"
            if version then executorName = executorName .. " " .. version end
        end
    end)
    
    if showStatus then
        showStatus("Validating key...", Color3.fromRGB(148, 163, 184))
    end
    
    local extraHeaders = nil
    if isAutoValidate then
        extraHeaders = { ["X-Auto-Validate"] = "true" }
    end
    
    local response, err = httpRequest("/loader/validate", "POST", {
        key = key,
        hwid = hwid,
        placeId = PlaceId,
        executor = executorName
    }, extraHeaders)
    
    if not response then
        return false, "Connection error: " .. (err or "Unknown")
    end
    
    if response.valid then
        saveKey(key)
        
        if showStatus then
            showStatus("Key validated! Loading script...", Color3.fromRGB(34, 197, 94))
        end
        
        local script, scriptErr = loadScript(response.scriptUrl, response.scriptToken)
        
        if script then
            if showStatus then
                showStatus("Script loaded! Executing...", Color3.fromRGB(34, 197, 94))
            end
            
            wait(0.5)
            
            local success, execErr = pcall(function()
                loadstring(script)()
            end)
            
            if not success then
                updateProgress(100, "[X] Script error: " .. tostring(execErr), COLORS.ERROR)
            end
            
            return true, nil
        else
            return false, "Failed to load script: " .. (scriptErr or "Unknown")
        end
    else
        local statusMessages = {
            invalid = "Invalid key",
            disabled = "Key is disabled",
            expired = "Key has expired",
            banned = "Account is banned",
            hwid_mismatch = "HWID mismatch - Reset on website",
            hwid_reset_pending = "HWID was reset - Enter key manually",
            checkpoints_pending = "Complete checkpoints on website",
            no_script = "No script for this game",
            game_maintenance = "This game is under maintenance",
            game_paused = "This script is paused"
        }
        
        local message = statusMessages[response.status] or response.message or "Validation failed"
        
        if response.status == "checkpoints_pending" then
            message = message .. " (" .. response.checkpointsCompleted .. "/" .. response.checkpointsRequired .. ")"
        end
        
        if response.status == "invalid" or response.status == "expired" or response.status == "disabled" or response.status == "hwid_mismatch" or response.status == "hwid_reset_pending" then
            deleteSavedKey()
        end
        
        -- Kick player if game is in maintenance or paused (return true to prevent GUI from opening)
        if response.status == "game_maintenance" then
            LocalPlayer:Kick(response.message or "This game is currently under maintenance. Please try again later.")
            return true, nil, response.status -- Return true to stop execution
        elseif response.status == "game_paused" then
            LocalPlayer:Kick("This script is currently paused and unavailable for use.")
            return true, nil, response.status -- Return true to stop execution
        end
        
        return false, message, response.status
    end
end

-- Main function
local function main()
    -- Get executor name
    local executorName = "Unknown"
    pcall(function()
        if identifyexecutor then
            local name, version = identifyexecutor()
            executorName = name or "Unknown"
            if version then executorName = executorName .. " " .. version end
        end
    end)
    
    -- Initialize the single line logger
    initLogger()
    
    -- All updates happen on the same line
    updateProgress(0, "Wisper Hub v" .. CONFIG.VERSION .. " | " .. executorName, COLORS.ACCENT)
    wait(0.2)
    
    updateProgress(10, "Connecting to server...", COLORS.ACCENT)
    
    local hubInfo, err = httpRequest("/loader/info", "GET")
    
    if not hubInfo then
        updateProgress(100, "[X] Connection failed!", COLORS.ERROR)
        return
    end
    
    updateProgress(30, "Connected to " .. (hubInfo.hubName or "Wisper Hub"), COLORS.ACCENT)
    wait(0.2)
    
    if hubInfo.maintenance then
        LocalPlayer:Kick(hubInfo.message or "Wisper Hub is currently under maintenance. Please try again later.")
        return
    end
    
    updateProgress(50, "Generating HWID...", COLORS.ACCENT)
    local hwid = generateHWID()
    wait(0.2)
    
    updateProgress(70, "HWID: " .. string.sub(hwid, 1, 8) .. "...", COLORS.ACCENT)
    wait(0.2)
    
    local savedKey = loadSavedKey()
    if savedKey then
        updateProgress(80, "Found saved key, validating...", COLORS.ACCENT)
        
        local success, errorMsg, status = validateAndExecute(savedKey, hwid, hubInfo, function(msg, color)
            updateProgress(90, msg, color)
        end, true)
        
        if success then
            updateProgress(100, "[OK] Script loaded successfully!", COLORS.SUCCESS)
            return
        end
        
        -- If kicked (maintenance/paused), don't continue
        if status == "game_maintenance" or status == "game_paused" then
            return
        end
        
        updateProgress(100, "[!] " .. (errorMsg or "Auto-validation failed"), COLORS.WARNING)
        wait(1)
    else
        updateProgress(100, "[*] Ready - Enter your key", COLORS.INFO)
    end
    
    local gui = createGUI()
    
    gui.GetKeyButton.MouseButton1Click:Connect(function()
        if setclipboard then
            setclipboard(hubInfo.websiteUrl or CONFIG.API_URL:gsub("/api", ""))
        end
        setStatus(gui, "Website URL copied!", Color3.fromRGB(34, 197, 94))
        wait(2)
        setStatus(gui, "Enter your key to continue", Color3.fromRGB(148, 163, 184))
    end)
    
    gui.ValidateButton.MouseButton1Click:Connect(function()
        local key = gui.KeyInput.Text:upper():gsub("%s", "")
        
        if key == "" then
            setStatus(gui, "Please enter a key", Color3.fromRGB(239, 68, 68))
            return
        end
        
        if not key:match("^WISPER%-%w%w%w%w%-%w%w%w%w%-%w%w%w%w%-%w%w%w%w$") then
            setStatus(gui, "Invalid key format", Color3.fromRGB(239, 68, 68))
            return
        end
        
        setButtonState(gui.ValidateButton, false, "Validating...")
        
        local success, errorMsg, status = validateAndExecute(key, hwid, hubInfo, function(msg, color)
            setStatus(gui, msg, color)
        end, false)
        
        if success then
            wait(0.5)
            gui.ScreenGui:Destroy()
        else
            -- If kicked (maintenance/paused), destroy GUI
            if status == "game_maintenance" or status == "game_paused" then
                gui.ScreenGui:Destroy()
                return
            end
            setStatus(gui, errorMsg or "Validation failed", Color3.fromRGB(239, 68, 68))
            setButtonState(gui.ValidateButton, true, "Validate Key")
        end
    end)
    
    wait(0.5)
    gui.KeyInput:CaptureFocus()
end

-- Entry point (error reporting is handled by bootstrap wrapper)
if game and Players and LocalPlayer then
    main()
end
