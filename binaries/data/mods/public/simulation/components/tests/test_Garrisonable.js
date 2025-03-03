Engine.LoadComponentScript("interfaces/Garrisonable.js");
Engine.LoadComponentScript("interfaces/GarrisonHolder.js");
Engine.LoadComponentScript("interfaces/UnitAI.js");
Engine.LoadComponentScript("Garrisonable.js");

Engine.RegisterGlobal("ApplyValueModificationsToEntity", (prop, oVal, ent) => oVal);

const garrisonHolderID = 1;
const garrisonableID = 2;
AddMock(garrisonHolderID, IID_GarrisonHolder, {
	"Garrison": () => true,
	"GetSpawnPosition": () => new Vector3D(0, 0, 0),
	"IsAllowedToGarrison": () => true,
	"OrderToRallyPoint": () => {},
	"Eject": () => true
});

let size = 1;
let cmpGarrisonable = ConstructComponent(garrisonableID, "Garrisonable", {
	"Size": size
});

TS_ASSERT_EQUALS(cmpGarrisonable.UnitSize(), size);
TS_ASSERT_EQUALS(cmpGarrisonable.TotalSize(), size);

let extraSize = 2;
AddMock(garrisonableID, IID_GarrisonHolder, {
	"OccupiedSlots": () => extraSize
});

TS_ASSERT_EQUALS(cmpGarrisonable.UnitSize(), size);
TS_ASSERT_EQUALS(cmpGarrisonable.TotalSize(), size + extraSize);

// Test garrisoning.

TS_ASSERT(cmpGarrisonable.Garrison(garrisonHolderID));
TS_ASSERT_UNEVAL_EQUALS(cmpGarrisonable.HolderID(), garrisonHolderID);

TS_ASSERT(!cmpGarrisonable.Garrison(garrisonHolderID));
TS_ASSERT_UNEVAL_EQUALS(cmpGarrisonable.HolderID(), garrisonHolderID);

cmpGarrisonable.UnGarrison();
TS_ASSERT_UNEVAL_EQUALS(cmpGarrisonable.HolderID(), INVALID_ENTITY);

// Test renaming.
const newGarrisonableID = 3;
let cmpGarrisonableNew = ConstructComponent(newGarrisonableID, "Garrisonable", {
	"Size": 1
});
TS_ASSERT(cmpGarrisonable.Garrison(garrisonHolderID));
cmpGarrisonable.OnEntityRenamed({ "entity": garrisonableID, "newentity": newGarrisonableID });
TS_ASSERT_UNEVAL_EQUALS(cmpGarrisonable.HolderID(), INVALID_ENTITY);
TS_ASSERT_UNEVAL_EQUALS(cmpGarrisonableNew.HolderID(), garrisonHolderID);
