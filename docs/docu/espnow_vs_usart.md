

||espnow|uart/usart |
|-|-|-|
|TX current|\~170mA burst (radio on)|\~5mA|
|Idle current|\~20mA (WiFi radio on)|1mA|
|Range|up to 200m|cm to meters (wire only)|
|Speed|1Mbps|up to 5Mbps|

|Library size|\~20-30KB|\~2-3KB|
|-|-|-|

|RAM usage|\~50-100KB|\~256 bytes|
|-|-|-|

|Built into Arduino core|no|yes|
|-|-|-|



La communication UART a été retenue pour relier les deux ESP32 pour plusieurs raisons techniques concrètes.

Sur le plan des ressources, l'UART est nettement plus léger en mémoire flash et en RAM. Sur un ESP1 déjà chargé (WiFi + BLE + MQTT + SD + HTTP), cette économie est significative et réduit le risque de manque de mémoire.

Sur le plan énergétique, l'ESP-NOW maintient la radio WiFi active en permanence sur l'ESP2 même sans connexion à un réseau, ce qui génère une dissipation thermique supplémentaire sur le régulateur LDO — problème déjà observé en pratique avec des échauffements anormaux lors des tests.

Sur le plan de la latence et de la fiabilité, l'UART offre une communication filaire déterministe sans risque d'interférence radio, ce qui est essentiel pour une liaison temps-réel entre un contrôleur de vol et un module de communication.

Enfin, l'UART est natif dans le core Arduino, sans bibliothèque externe, ce qui simplifie le code et réduit les dépendances logicielles.

En résumé, pour une liaison courte distance entre deux cartes montées sur le même drone, l'UART est plus léger, plus froid, plus rapide et plus fiable que l'ESP-NOW.

