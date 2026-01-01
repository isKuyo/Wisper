--[[

        ──◦ rwque ◦──
        Client Validation Script

]]

local Services = setmetatable({}, {
    __index = function(_, Service)
        return game:GetService(Service)
    end
})

local Players = Services.Players
local RunService = Services.RunService
local UserInputService = Services.UserInputService
local TweenService = Services.TweenService
local HttpService = Services.HttpService

local LocalPlayer = Players.LocalPlayer
local PlayerGui = LocalPlayer:WaitForChild("PlayerGui")

local State = {
    Initialized = false,
    Heartbeat = 0,
    Connections = {},
    Cache = {},
}

local Utils = {}

function Utils:GenerateId()
    return HttpService:GenerateGUID(false)
end

function Utils:SafeCall(Func, ...)
    local Ok, Result = pcall(Func, ...)
    if not Ok then
        warn("[Client] Error:", Result)
    end
    return Ok, Result
end

function Utils:Create(Class, Properties)
    local Obj = Instance.new(Class)
    for k, v in pairs(Properties) do
        Obj[k] = v
    end
    return Obj
end

local Interface = {}

function Interface:CreateNotice()
    local ScreenGui = Utils:Create("ScreenGui", {
        Name = Utils:GenerateId(),
        ResetOnSpawn = false,
        Parent = PlayerGui
    })

    local Frame = Utils:Create("Frame", {
        Size = UDim2.fromScale(0.3, 0.1),
        Position = UDim2.fromScale(0.35, 0.45),
        BackgroundColor3 = Color3.fromRGB(15, 15, 15),
        BorderSizePixel = 0,
        Parent = ScreenGui
    })

    Utils:Create("UICorner", {
        CornerRadius = UDim.new(0, 12),
        Parent = Frame
    })

    local Text = Utils:Create("TextLabel", {
        Size = UDim2.fromScale(1, 1),
        BackgroundTransparency = 1,
        Text = "Client script executado com sucesso",
        TextColor3 = Color3.fromRGB(220, 220, 220),
        Font = Enum.Font.GothamMedium,
        TextScaled = true,
        Parent = Frame
    })

    TweenService:Create(
        Frame,
        TweenInfo.new(0.6, Enum.EasingStyle.Quint, Enum.EasingDirection.Out),
        {BackgroundColor3 = Color3.fromRGB(25, 25, 25)}
    ):Play()

    task.delay(3, function()
        ScreenGui:Destroy()
    end)
end

local Monitor = {}

function Monitor:Start()
    State.Connections.Heartbeat = RunService.Heartbeat:Connect(function(dt)
        State.Heartbeat += dt
    end)

    State.Connections.Input = UserInputService.InputBegan:Connect(function(Input, gp)
        if gp then return end
        State.Cache.LastInput = Input.KeyCode.Name
    end)
end

function Monitor:Stop()
    for _, Connection in pairs(State.Connections) do
        Connection:Disconnect()
    end
end

local Bootstrap = {}

function Bootstrap:Init()
    if State.Initialized then
        return
    end

    State.Initialized = true
    State.Cache.SessionId = Utils:GenerateId()
    State.Cache.StartTime = os.clock()

    Monitor:Start()
    Interface:CreateNotice()

    print("[Client] Script executado com sucesso")
    print("[Client] Session:", State.Cache.SessionId)
end

Utils:SafeCall(function()
    Bootstrap:Init()
end)
