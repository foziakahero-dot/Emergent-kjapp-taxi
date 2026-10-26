"""Select only an owned, Stripe-verified card; one user pointer owns the default."""
from bson import ObjectId
from bson.errors import InvalidId


async def selected_payment_method(db, user_id, user):
    query = {"user_id": user_id, "verified": True, "setup_status": "succeeded",
             "stripe_payment_method_id": {"$type": "string"}}
    default = (user or {}).get("default_payment_method_id")
    if default:
        try:
            chosen = await db.payment_methods.find_one({**query, "_id": ObjectId(default)})
            if chosen:
                return chosen
        except (InvalidId, TypeError):
            pass
    return await db.payment_methods.find_one(query, sort=[("is_default", -1), ("created_at", -1)])
