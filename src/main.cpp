#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <DHTesp.h>

const char *ssid = "";
const char *password = "";

DHTesp dht;

void setup()
{
	dht.setup(D4, DHTesp::DHT11); // Connect DHT sensor to GPIO 17

	Serial.begin(115200); // Start the Serial communication to send messages to the computer
	delay(10);
	Serial.println('\n');

	WiFi.begin(ssid, password); // Connect to the network
	Serial.print("Connecting to ");
	Serial.print(ssid);
	Serial.println(" ...");

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
	delay(dht.getMinimumSamplingPeriod());

	float humidity = dht.getHumidity();
	float temperature = dht.getTemperature();

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

	ESP.deepSleep(30 * 60 * 1000 * 1000);
}
