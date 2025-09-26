let last_publish_time = 0
let message: { topic: string; message: string; } = null
const MQTT_TOPIC = `emakefun/sensor/${control.deviceSerialNumber()}/testtopic`
let display_state = true
serial.redirect(
    SerialPin.P1,
    SerialPin.P0,
    BaudRate.BaudRate9600
)
emakefun.initEspAtModule()
emakefun.wifiConnect("emakefun", "501416wf")
emakefun.mqttUserConfig(
    emakefun.connectionScheme.kMqttOverTcp,
    "my_client_id",
    "my_user_name",
    "my_password",
    ""
)
emakefun.mqttConnect("broker.emqx.io", 1883, true)
emakefun.mqttSubscribe(MQTT_TOPIC, 0)
basic.showIcon(IconNames.Happy)
basic.forever(function () {
    message = emakefun.mqttReceive(500)
    if (message && message.topic == MQTT_TOPIC) {
        if (message.message == "display on") {
            led.enable(true)
            display_state = !(display_state)
        } else if (message.message == "display off") {
            led.enable(false)
            display_state = !(display_state)
        }
    }
    if (input.runningTime() - last_publish_time > 1000) {
        let send_content = display_state ? "display on" : "display off"
        emakefun.mqttPublish(
            send_content,
            MQTT_TOPIC,
            1000,
            0,
            false
        )
        last_publish_time = input.runningTime()
    }
})
