//%block="Emakefun"
namespace emakefun {


    /**
     * MQTT connection scheme options.
     */
    export enum connectionScheme {
        //% block="TCP"
        kMqttOverTcp = 1,
        //% block="TLS (not verifying certificates)"
        kMqttOverTlsNoVerify = 2,
        //% block="TLS (verify server certificate)"
        kMqttOverTlsVerifyServerCert = 3,
        //% block="TLS (provide client certificate)"
        kMqttOverTlsProvideClientCert = 4,
        //% block="TLS (mutual authentication)"
        kMqttOverTlsMutualVerify = 5,
        //% block="WebSocket (Based on TCP)"
        kMqttOverWebSocket = 6,
        //% block="WebSocket (Based on TLS, not verifying certificates)"
        kMqttOverWebSocketSecureNoVerify = 7,
        //% block="WebSocket (Based on TLS, verify server certificate)"
        kMqttOverWebSocketSecureVerifyServerCert = 8,
        //% block="WebSocket (Based on TLS, provide client certificate)"
        kMqttOverWebSocketSecureProvideClientCert = 9,
        //% block="WebSocket (Based on TLS, mutual authentication)"
        kMqttOverWebSocketSecureMutualVerify = 10
    }

    /**
     * Send AT command and wait for specific response.
     * @param command The AT command string to be sent (does not need to include carriage returns or line breaks).
     * @param success_target Response string indicating successful command execution.
     * @param timeout_ms Timeout for waiting for response (milliseconds).
     * @returns If receiving a success_target response, return true; otherwise, return false.
     */
    function writeCommand(command: string, success_target: string, timeout_ms: number): boolean {
        if (!command || !success_target || timeout_ms < 0) {
            throw "Error: 'writeCommand' function, invalid parameters.";
        }
        const targets = [success_target, "\r\nERROR\r\n", "busy p...\r\n"];
        serial.writeString(command + "\r\n");
        return emakefun.multiFindUtil(targets, timeout_ms) == 0
    }

    /**
     * Cancel send.
     */
    export function cancelSend(): boolean {
        basic.pause(30);
        serial.writeString("+++")
        if (!emakefun.singleFindUtil("\r\nSEND Canceled\r\n", 500)) {
            return false;
        }
        return true;
    }

    /**
     * Initialize ESP-AT module.
     */
    //% block="Initialize ESP-AT module"
    //% subcategory="EspAt"
    //% tx_pin.defl=SerialPin.P1
    //% rx_pin.defl=SerialPin.P0
    //% baud_rate.defl=BaudRate.BaudRate9600
    //% weight=100
    export function initEspAtModule(): void {
        restart(2000);
        const at_commands = [
            "ATE0",
            "AT+CWINIT=1",
            "AT+CWMODE=1",
            "AT+CIPDINFO=1",
            "AT+CWAUTOCONN=0",
            "AT+CWDHCP=1,1"
        ];
        for (let command of at_commands) {
            if (!writeCommand(command, "\r\nOK\r\n", 500)) {
                basic.showNumber(30)
                throw "Error: module init failed.";
            }
        }
    }

    /**
     * Restart ESP-AT module.
     * @param timeout_ms Timeout for waiting for response (milliseconds).
     */
    //% block="restart ESP-AT module, timeout(ms) %timeout_ms"
    //% subcategory="EspAt"
    //% timeout_ms.min=0
    //% timeout_ms.defl=2000
    //% weight=99
    export function restart(timeout_ms: number): void {
        const end_time = input.runningTime() + timeout_ms;
        do {
            serial.writeString("AT+RST" + "\r\n");
            basic.pause(100);
            basic.showString("!2:" + serial.readBuffer(0).toString());
            basic.showString("!3:" + serial.readBuffer(0).toString());
            basic.showString("!4:" + serial.readBuffer(0).toString());
            basic.showString("!5:" + serial.readBuffer(0).toString());
            cancelSend();
            basic.pause(2000);
            basic.showString("22");

            // if (!writeCommand("AT+RST", "\r\nOK\r\n", 1000)) {
            //     basic.showNumber(11);
            //     cancelSend();
            //     continue;
            // }
            // if (!emakefun.singleFindUtil("\r\nready\r\n", 1000)) {
            //     basic.showNumber(12);
            //     cancelSend();
            //     continue;

            // }
            // if (!writeCommand("AT", "\r\nOK\r\n", 100)) {
            //     basic.showNumber(20)
            //     throw "Error: WiFi connection failed.";
            // }
            // return;

            // } while (input.runningTime() < end_time);
        } while (true);
        basic.showNumber(10)
        throw "Error: module restart failed.";
    }

    /**
     * Connect to WiFi.
     * @param ssid Wifi SSID.
     * @param password Wifi Password.
     */
    //% block="connect to WiFi: SSID $ssid Password $password"
    //% subcategory="EspAt"
    //% group="WiFi"
    //% weight=90
    export function wifiConnect(ssid: string, password: string): void {
        const command = `AT+CWJAP="${ssid}","${password}"`;
        if (!writeCommand(command, "\r\nOK\r\n", 15000)) {
            throw "Error: WiFi connection failed.";
        }
    }

    /**
     * Get the WiFi ip information.
     * @returns The ip, gateway, and netmask information of the current WiFi connection.
     */
    //% block="get the WiFi ip information"
    //% subcategory="EspAt"
    //% group="WiFi"
    //% weight=85
    export function getIpInfo(): { ip: string, gateway: string, netmask: string } {
        if (!writeCommand("AT+CIPSTA?", '+CIPSTA:ip:"', 500)) {
            return null;
        }
        const ip = emakefun.readUntil('"', 500);

        let gateway = "";
        let netmask = "";

        if (emakefun.singleFindUtil('+CIPSTA:gateway:"', 100)) {
            gateway = emakefun.readUntil('"', 500);
        }
        if (emakefun.singleFindUtil('+CIPSTA:netmask:"', 100)) {
            netmask = emakefun.readUntil('"', 500);
        }
        if (!ip || !gateway || !netmask) {
            return null;
        }
        if (emakefun.singleFindUtil("\r\nOK\r\n", 100)) {
            return { ip, gateway, netmask };
        }

        return null;
    }

    /**
     * Get the WiFi mac address.
     * @returns The current mac address connected to WiFi.
     */
    //% block="get the WiFi MAC address"
    //% subcategory="EspAt"
    //% group="WiFi"
    //% weight=80
    export function getMac(): string {
        if (!writeCommand("AT+CIPSTAMAC?", '+CIPSTAMAC:"', 500)) {
            return null;
        }
        const mac = emakefun.readUntil('"', 500);
        if (!mac) {
            return null;
        }
        if (emakefun.singleFindUtil("\r\nOK\r\n", 100)) {
            return mac;
        }
        return null;
    }

    /**
     * Get the WiFi ap information.
     * @returns The ap information of the current WiFi connection.
     */
    //% block="get the WiFi ap information"
    //% subcategory="EspAt"
    //% group="WiFi"
    //% weight=75
    export function getApInfo(): { ssid: string, bssid: string, channel: number, rssi: number } {
        if (!writeCommand("AT+CWJAP?", '+CWJAP:"', 500)) {
            return null;
        }
        const ssid = emakefun.readUntil('"', 500);
        if (!ssid || !emakefun.skipNext(",", 100) ||
            !emakefun.skipNext('"', 100)) {
            return null;
        }
        const bssid = emakefun.readUntil('"', 500);
        if (!bssid || !emakefun.skipNext(",", 100)) {
            return null;
        }
        const channel = emakefun.parseNumber(500);
        const rssi = emakefun.parseNumber(500);
        if (isNaN(channel) || isNaN(rssi)) {
            return null;
        }

        if (emakefun.singleFindUtil("\r\nOK\r\n", 100)) {
            return { ssid, bssid, channel, rssi };
        }
        return null;
    }

    /**
     * MQTT set user properties.
     * @param scheme MQTT connection scheme.
     * @param client_id MQTT client ID.
     * @param username Username.
     * @param password Password.
     * @param path Resource path.
     */
    //% block="MQTT set user properties:|connection scheme $scheme|client ID $client_id|username $username|password $password|resource path $path"
    //% subcategory="EspAt"
    //% group="MQTT"
    //% scheme.defl=connectionScheme.kMqttOverTcp
    //% weight=70
    export function mqttUserConfig(scheme: connectionScheme, client_id: string, username: string, password: string, path: string): void {
        const command = `AT+MQTTUSERCFG=0,${scheme},"${client_id}","${username}","${password}",0,0,"${path}"`;
        if (!writeCommand(command, "\r\nOK\r\n", 500)) {
            throw "Error: MQTT configuration user properties failed.";
        }
    }

    /**
     * MQTT to connect server.
     * @param host Server host.
     * @param port Server port. 
     * @param reconnect Whether to enable automatically reconnect.
     */
    //% block="MQTT to connect server: host $host port $port automatic|reconnect $reconnect"
    //% subcategory="EspAt"
    //% group="MQTT"
    //% port.min=1
    //% port.max=65535
    //% port.defl=1
    //% reconnect.defl=true
    //% weight=65
    export function mqttConnect(host: string, port: number, reconnect: boolean): void {
        const command = `AT+MQTTCONN=0,"${host}",${port},${reconnect ? 1 : 0}`;
        if (!writeCommand(command, "\r\nOK\r\n", 10000)) {
            throw "Error: MQTT connection failed.";
        }
    }

    /**
     * MQTT publish messages.
     * @param topic MQTT topic.
     * @param data MQTT string message data.
     * @param qos QoS level.
     * @param retain Whether to keep the message.
     * @param timeout_ms Timeout for waiting for response (milliseconds).
     */
    //% block="MQTT publish messages $data|to topic $topic|timeout(ms) %timeout_ms|QoS $qos|retain $retain"
    //% subcategory="EspAt"
    //% group="MQTT"
    //% qos.min=0
    //% qos.max=2
    //% qos.defl=0
    //% retain.defl=false
    //% timeout_ms.min=0
    //% timeout_ms.defl=1000
    //% weight=55
    export function mqttPublish(data: string, topic: string, timeout_ms: number, qos: number, retain: boolean): void {
        const data_bytes = Buffer.fromUTF8(data);
        const command = `AT+MQTTPUBRAW=0,"${topic}",${data_bytes.length},${qos},${retain ? 1 : 0}`;
        if (!writeCommand(command, "\r\nOK\r\n\r\n>", 500)) {
            throw "Error: MQTT publish content failed.";
        }
        const targets = ["+MQTTPUB:OK", "+MQTTPUB:FAIL"];
        serial.writeBuffer(data_bytes);
        if (emakefun.multiFindUtil(targets, timeout_ms) != 0) {
            throw "Error: MQTT publish content failed.";
        }
    }

    /**
     * MQTT subscribe topic.
     * @param topic MQTT topic.
     * @param qos QoS level.
     */
    //% block="MQTT subscribe topic $topic|QoS $qos"
    //% subcategory="EspAt"
    //% group="MQTT"
    //% qos.min=0
    //% qos.max=2
    //% qos.defl=0
    //% weight=50
    export function mqttSubscribe(topic: string, qos: number): void {
        const command = `AT+MQTTSUB=0,"${topic}",${qos}`;
        if (!writeCommand(command, "\r\nOK\r\n", 500)) {
            throw "Error: MQTT subscription failed.";
        }
    }

    /**
     * MQTT unsubscribe topic.
     * @param topic MQTT topic.
     */
    //% block="MQTT unsubscribe topic $topic"
    //% subcategory="EspAt"
    //% group="MQTT"
    //% weight=45
    export function mqttUnsubscribe(topic: string): void {
        const command = `AT+MQTTUNSUB=0,"${topic}"`;
        if (!writeCommand(command, "\r\nOK\r\n", 500)) {
            throw "Error: MQTT unsubscription failed.";
        }
    }

    /**
     * MQTT disconnect connection.
     */
    //% block="MQTT disconnect connection"
    //% subcategory="EspAt"
    //% group="MQTT"
    //% weight=40
    export function mqttDisconnect(): void {
        if (!writeCommand("AT+MQTTCLEAN=0", "\r\nOK\r\n", 500)) {
            throw "Error: MQTT disconnect failed.";
        }
    }

    /**
     * MQTT receive messages.
     * @param timeout_ms Timeout for waiting for response (milliseconds).
     * @returns Return an object containing topic and message string. If failed, topic is empty and message is empty string.
     */
    //% block="MQTT receive messages, timeout(ms) $timeout_ms"
    //% subcategory="EspAt"
    //% group="MQTT"
    //% timeout_ms.defl=500
    //% timeout_ms.min=0
    //% weight=35
    export function mqttReceive(timeout_ms: number): { topic: string, message: string } {
        if (!emakefun.singleFindUtil('+MQTTSUBRECV:0,"', timeout_ms)) {
            return null;
        }
        const topic = emakefun.readUntil('"', 500);

        if (!topic || !emakefun.skipNext(",", 100)) {
            return null;
        }
        const length = emakefun.parseNumber(500);
        if (isNaN(length) || length <= 0) {
            return null;
        }
        const message_data = emakefun.readBytes(length, 1000);
        if (!message_data) {
            return null;
        }
        return { topic: topic, message: message_data.toString() };
    }
}
