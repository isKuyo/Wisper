--[[
    WISPER HUB BOOTSTRAP
    Execute this script to load the hub with error reporting
]]

local API_URL = "http://localhost:3001"

-- Get executor info
local function getExecutorName()
    local name = "Unknown"
    pcall(function()
        if identifyexecutor then
            name = identifyexecutor() or "Unknown"
        end
    end)
    return name
end

-- Report error to API
local function reportError(errorMsg, stack, phase)
    pcall(function()
        local HttpService = game:GetService("HttpService")
        local Players = game:GetService("Players")
        
        local body = HttpService:JSONEncode({
            error = tostring(errorMsg),
            stack = tostring(stack or ""),
            executor = getExecutorName(),
            placeId = game.PlaceId,
            userId = Players.LocalPlayer and Players.LocalPlayer.UserId or 0,
            phase = phase or "unknown",
            timestamp = os.time() * 1000
        })
        
        local requestFunc = syn and syn.request or request or http_request
        if requestFunc then
            requestFunc({
                Url = API_URL .. "/api/loader/error",
                Method = "POST",
                Headers = { ["Content-Type"] = "application/json" },
                Body = body
            })
        end
    end)
end

-- Main bootstrap
local function bootstrap()
    print("[Wisper Hub] Bootstrap starting...")
    print("[Wisper Hub] Executor: " .. getExecutorName())
    
    -- Try to fetch the loader
    local loaderCode = nil
    local fetchError = nil
    
    local success, result = pcall(function()
        local requestFunc = syn and syn.request or request or http_request
        
        if not requestFunc then
            error("No HTTP request function available (syn.request, request, or http_request)")
        end
        
        local response = requestFunc({
            Url = API_URL .. "/loader",
            Method = "GET",
            Headers = {
                ["User-Agent"] = "Roblox/WinInet",
                ["Accept"] = "text/plain"
            }
        })
        
        if response.StatusCode ~= 200 then
            error("Server returned status " .. tostring(response.StatusCode) .. ": " .. tostring(response.Body):sub(1, 200))
        end
        
        return response.Body
    end)
    
    if not success then
        fetchError = "Fetch failed: " .. tostring(result)
        print("[Wisper Hub] " .. fetchError)
        reportError(fetchError, debug.traceback(), "fetch")
        return
    end
    
    loaderCode = result
    
    -- Check if we got valid Lua code
    if not loaderCode or loaderCode == "" then
        fetchError = "Empty response from server"
        print("[Wisper Hub] " .. fetchError)
        reportError(fetchError, "", "fetch")
        return
    end
    
    -- Check if response is HTML (error page)
    if loaderCode:sub(1, 1) == "<" or loaderCode:lower():find("<!doctype") or loaderCode:lower():find("<html") then
        fetchError = "Server returned HTML instead of Lua: " .. loaderCode:sub(1, 300)
        print("[Wisper Hub] " .. fetchError)
        reportError(fetchError, "", "fetch")
        return
    end
    
    -- Try to compile the code
    local chunk, compileError = loadstring(loaderCode)
    
    if not chunk then
        local errorMsg = "Compile error: " .. tostring(compileError)
        print("[Wisper Hub] " .. errorMsg)
        reportError(errorMsg, loaderCode:sub(1, 500), "compile")
        return
    end
    
    print("[Wisper Hub] Loader compiled successfully, executing...")
    
    -- Execute the loader
    local execSuccess, execError = pcall(chunk)
    
    if not execSuccess then
        local errorMsg = "Execution error: " .. tostring(execError)
        print("[Wisper Hub] " .. errorMsg)
        reportError(errorMsg, debug.traceback(), "execute")
        return
    end
    
    print("[Wisper Hub] Loader executed successfully!")
end

-- Run bootstrap with error handling
local ok, err = pcall(bootstrap)
if not ok then
    print("[Wisper Hub] Bootstrap crashed: " .. tostring(err))
    reportError("Bootstrap crash: " .. tostring(err), debug.traceback(), "bootstrap")
end
