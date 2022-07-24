#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <DHTesp.h>

const char *ssid = "🌡️";
const char *password = "sensors-esp8266";

const char* url = "http://192.168.1.88/esp8266/sensor";
//const char* sensorName = "exterior";
const char* sensorName = "cave";
const int waitMinutes = 10; // minimum 2 minutes

DHTesp dht;

void setup()
{
	dht.setup(D4, DHTesp::DHT22); // Connect DHT sensor to GPIO 17

	Serial.begin(115200); // Start the Serial communication to send messages to the computer
	delay(10);
	Serial.println('\n');

	WiFi.begin(ssid, password); // Connect to the network
	Serial.print("Connecting to ");
	Serial.print(ssid);
	Serial.println("...");

	int i = 0;
	while (WiFi.status() != WL_CONNECTED)
	{ // Wait for the Wi-Fi to connect
		delay(1000);
		Serial.print(++i);
		Serial.print(' ');
	}

	Serial.println('\n');
	Serial.println("Connection established!");
	Serial.print("IP address:\t");
	Serial.println(WiFi.localIP()); // Send the IP address of the ESP8266 to the computer

	Serial.println("Status\tHumidity (%)\tTemperature (C)\t(F)\tHeatIndex (C)\t(F)");
}

void loop()
{
	float humidity = 0;
	float temperature = 0;

	int const count = 3;
	for (int i = 0; i < count; ++i) {
		delay(dht.getMinimumSamplingPeriod());
		humidity += dht.getHumidity();
		temperature += dht.getTemperature();
	}
	humidity /= count;
	temperature /= count;

	Serial.print(dht.getStatusString());
	Serial.print("\t");
	Serial.print(humidity, 1);
	Serial.print("\t\t");
	Serial.print(temperature, 1);
	Serial.print("\t\t");
	Serial.print(dht.toFahrenheit(temperature), 1);
	Serial.print("\t\t");
	Serial.print(dht.computeHeatIndex(temperature, humidity, false), 1);
	Serial.print("\t\t");
	Serial.println(dht.computeHeatIndex(dht.toFahrenheit(temperature), humidity, true), 1);

	WiFiClient client;
	HTTPClient http;
	if (http.begin(client, url))
	{
		http.addHeader("Content-Type", "application/json");
		http.POST(String("{\"name\":\"") + sensorName + "\", \"temperature\": " + temperature + ", \"humidity\": " + humidity + "}");
		http.end();
		Serial.println("http sent");
	}

	ESP.deepSleep((waitMinutes - 1) * 60 * 1000 * 1000);
}
