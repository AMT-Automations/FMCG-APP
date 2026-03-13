#!/usr/bin/env python3
"""
Quick debug of data isolation logic
"""

# Simulating the data
products_data = []  # Empty list
orders_data = []    # Empty list
products_success = True
orders_success = True

# Current logic
rival_isolation_products = products_success and products_data and len(products_data) == 0
rival_isolation_orders = orders_success and orders_data and len(orders_data) == 0

print(f"products_success: {products_success}")
print(f"products_data: {products_data}")
print(f"len(products_data) == 0: {len(products_data) == 0}")
print(f"products_data (truthy): {bool(products_data)}")
print(f"rival_isolation_products: {rival_isolation_products}")

print(f"\norders_success: {orders_success}")
print(f"orders_data: {orders_data}")
print(f"len(orders_data) == 0: {len(orders_data) == 0}")
print(f"orders_data (truthy): {bool(orders_data)}")
print(f"rival_isolation_orders: {rival_isolation_orders}")

print(f"\nBoth isolation checks: {rival_isolation_products and rival_isolation_orders}")

# The issue is: products_data and orders_data evaluate to False when they're empty lists!
# So the logic should be:
correct_rival_isolation_products = products_success and len(products_data) == 0
correct_rival_isolation_orders = orders_success and len(orders_data) == 0

print(f"\nCORRECT logic:")
print(f"correct_rival_isolation_products: {correct_rival_isolation_products}")
print(f"correct_rival_isolation_orders: {correct_rival_isolation_orders}")
print(f"Both correct isolation checks: {correct_rival_isolation_products and correct_rival_isolation_orders}")