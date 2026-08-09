# User Manual
**Project Name:** ABC Restaurant Digital Menu System
---
## 1. For Customers
### 1.1 Browsing the Menu
1. Connect to the restaurant's Wi-Fi network.
2. Open your mobile browser or scan the table's QR Code to visit the system's URL (e.g. `http://192.168.25.61:3000`).
3. You will see the home screen. Tap **Start Ordering** to view the menu.
4. Use the categories at the top (e.g., Starters, Mains, Drinks) to filter the menu items.
5. Tap the language icon on the bottom navigation bar to switch between English and Amharic text.

### 1.2 Placing an Order
1. Tap the **+** (Plus) button next to any food item to add it to your cart.
2. Tap the **Cart** icon at the bottom of the screen to review your selected items.
3. You can tap an item in your cart to add special instructions (e.g. "No onions").
4. Enter your **Table Number** at the bottom of the check-out screen.
5. Tap **Place Order** to confirm. 

### 1.3 Tracking Your Order
1. Immediately after checkout, you will see a success screen.
2. The screen automatically updates! As the kitchen begins preparing your food, the **"Preparing"** icon will turn orange.
3. Once the food is ready to be delivered to your table, the screen will switch to **"Food is Ready! ✅"**.

---

## 2. For Administrators & Staff

### 2.1 Logging In
1. On a desktop or tablet connected to the restaurant Wi-Fi, open the Admin panel link (e.g. `http://192.168.25.61:3000/admin`).
2. Enter the administrator credentials to securely log in.

### 2.2 Managing Live Orders
1. Click on the **Orders** tab on the left sidebar.
2. When a customer places a new order, you will hear a notification sound and a visual popup will appear. The new order will automatically appear in your list.
3. Click the **"Eye" icon** to view the details of an order, including special instructions and the table number.
4. **Updating Status:** Use the dropdown menu in the "Status" column to move the order forward:
   - **New:** The order was just received.
   - **Preparing:** The kitchen has started cooking this order. *(Customers will see this live).*
   - **Ready:** The food is ready to be delivered to the table. *(Customers will see this live).*
   - **Served:** The food has been delivered and the order is complete.

### 2.3 Printing Receipts
1. Open the details of any order (by clicking the "Eye" icon).
2. Click the **Print** button in the top right corner.
3. This will immediately prepare a stylized thermal-printer receipt. Use your browser's print dialog to send it to the receipt printer.

### 2.4 Modifying Menu Items
1. Click the **Menu** tab on the left sidebar.
2. Use the "+ Add Item" button to create a new food item. Note that you must provide a Name, Category, Price, and Image URL.
3. Existing items can be edited or permanently deleted using the buttons in their respective rows.

---

## 3. Server Startup (IT/Manager Guide)
If the servers are turned off (e.g. in the morning), follow these steps:
1. Open the project folder `Digtal Menu` on your host PC.
2. Double click the **`start-api.bat`** file to boot the backend server.
3. Double click the **`start-frontend.bat`** file to boot the customer/admin interface.
4. *Important:* Make sure you run the **`open-firewall.vbs`** or **`open-firewall.bat`** file as administrator to allow mobile phones to connect over the network.
