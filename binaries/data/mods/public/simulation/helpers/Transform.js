// Helper functions to change an entity's template and check if the transformation is possible

// returns the ID of the new entity or INVALID_ENTITY.
function ChangeEntityTemplate(oldEnt, newTemplate)
{
	// Done un/packing, copy our parameters to the final entity
	var newEnt = Engine.AddEntity(newTemplate);
	if (newEnt == INVALID_ENTITY)
	{
		error("Transform.js: Error replacing entity " + oldEnt + " for a '" + newTemplate + "'");
		return INVALID_ENTITY;
	}

	var cmpPosition = Engine.QueryInterface(oldEnt, IID_Position);
	var cmpNewPosition = Engine.QueryInterface(newEnt, IID_Position);
	if (cmpPosition && cmpNewPosition)
	{
		if (cmpPosition.IsInWorld())
		{
			let pos = cmpPosition.GetPosition2D();
			cmpNewPosition.JumpTo(pos.x, pos.y);
		}
		let rot = cmpPosition.GetRotation();
		cmpNewPosition.SetYRotation(rot.y);
		cmpNewPosition.SetXZRotation(rot.x, rot.z);
		cmpNewPosition.SetHeightOffset(cmpPosition.GetHeightOffset());
	}

	var cmpOwnership = Engine.QueryInterface(oldEnt, IID_Ownership);
	var cmpNewOwnership = Engine.QueryInterface(newEnt, IID_Ownership);
	if (cmpOwnership && cmpNewOwnership)
		cmpNewOwnership.SetOwner(cmpOwnership.GetOwner());

	// Copy control groups
	CopyControlGroups(oldEnt, newEnt);

	// Rescale capture points
	var cmpCapturable = Engine.QueryInterface(oldEnt, IID_Capturable);
	var cmpNewCapturable = Engine.QueryInterface(newEnt, IID_Capturable);
	if (cmpCapturable && cmpNewCapturable)
	{
		let scale = cmpCapturable.GetMaxCapturePoints() / cmpNewCapturable.GetMaxCapturePoints();
		let newCapturePoints = cmpCapturable.GetCapturePoints().map(v => v / scale);
		cmpNewCapturable.SetCapturePoints(newCapturePoints);
	}

	// Maintain current health level
	var cmpHealth = Engine.QueryInterface(oldEnt, IID_Health);
	var cmpNewHealth = Engine.QueryInterface(newEnt, IID_Health);
	if (cmpHealth && cmpNewHealth)
	{
		var healthLevel = Math.max(0, Math.min(1, cmpHealth.GetHitpoints() / cmpHealth.GetMaxHitpoints()));
		cmpNewHealth.SetHitpoints(cmpNewHealth.GetMaxHitpoints() * healthLevel);
	}

	let cmpBuilderList = QueryBuilderListInterface(oldEnt);
	let cmpNewBuilderList = QueryBuilderListInterface(newEnt);
	if (cmpBuilderList && cmpNewBuilderList)
		cmpNewBuilderList.AddBuilders(cmpBuilderList.GetBuilders());

	var cmpUnitAI = Engine.QueryInterface(oldEnt, IID_UnitAI);
	var cmpNewUnitAI = Engine.QueryInterface(newEnt, IID_UnitAI);
	if (cmpUnitAI && cmpNewUnitAI)
	{
		let pos = cmpUnitAI.GetHeldPosition();
		if (pos)
			cmpNewUnitAI.SetHeldPosition(pos.x, pos.z);
		if (cmpUnitAI.GetStanceName())
			cmpNewUnitAI.SwitchToStance(cmpUnitAI.GetStanceName());
		if (cmpUnitAI.GetGarrisonHolder() != INVALID_ENTITY)
			cmpNewUnitAI.SetGarrisoned();
		cmpNewUnitAI.AddOrders(cmpUnitAI.GetOrders());
		if (cmpUnitAI.IsGuardOf())
		{
			let guarded = cmpUnitAI.IsGuardOf();
			let cmpGuard = Engine.QueryInterface(guarded, IID_Guard);
			if (cmpGuard)
			{
				cmpGuard.RenameGuard(oldEnt, newEnt);
				cmpNewUnitAI.SetGuardOf(guarded);
			}
		}
	}

	let cmpPromotion = Engine.QueryInterface(oldEnt, IID_Promotion);
	let cmpNewPromotion = Engine.QueryInterface(newEnt, IID_Promotion);
	if (cmpPromotion && cmpNewPromotion)
		cmpNewPromotion.IncreaseXp(cmpPromotion.GetCurrentXp());

	let cmpResGatherer = Engine.QueryInterface(oldEnt, IID_ResourceGatherer);
	let cmpNewResGatherer = Engine.QueryInterface(newEnt, IID_ResourceGatherer);
	if (cmpResGatherer && cmpNewResGatherer)
	{
		let carriedResources = cmpResGatherer.GetCarryingStatus();
		cmpNewResGatherer.GiveResources(carriedResources);
		cmpNewResGatherer.SetLastCarriedType(cmpResGatherer.GetLastCarriedType());
	}


	// Maintain the list of guards
	let cmpGuard = Engine.QueryInterface(oldEnt, IID_Guard);
	let cmpNewGuard = Engine.QueryInterface(newEnt, IID_Guard);
	if (cmpGuard && cmpNewGuard)
	{
		let entities = cmpGuard.GetEntities();
		if (entities.length)
		{
			cmpNewGuard.SetEntities(entities);
			for (let ent of entities)
			{
				let cmpEntUnitAI = Engine.QueryInterface(ent, IID_UnitAI);
				if (cmpEntUnitAI)
					cmpEntUnitAI.SetGuardOf(newEnt);
			}
		}
	}

	let cmpStatusEffectsReceiver = Engine.QueryInterface(oldEnt, IID_StatusEffectsReceiver);
	let cmpNewStatusEffectsReceiver = Engine.QueryInterface(newEnt, IID_StatusEffectsReceiver);
	if (cmpStatusEffectsReceiver && cmpNewStatusEffectsReceiver)
	{
		let activeStatus = cmpStatusEffectsReceiver.GetActiveStatuses();
		for (let status in activeStatus)
		{
			let newStatus = activeStatus[status];
			if (newStatus.Duration)
				newStatus.Duration -= newStatus._timeElapsed;
			cmpNewStatusEffectsReceiver.ApplyStatus({ [status]: newStatus }, newStatus.source.entity, newStatus.source.owner);
		}
	}

	TransferGarrisonedUnits(oldEnt, newEnt);

	Engine.PostMessage(oldEnt, MT_EntityRenamed, { "entity": oldEnt, "newentity": newEnt });

	if (cmpPosition && cmpPosition.IsInWorld())
		cmpPosition.MoveOutOfWorld();
	Engine.DestroyEntity(oldEnt);

	return newEnt;
}

function CopyControlGroups(oldEnt, newEnt)
{
	let cmpObstruction = Engine.QueryInterface(oldEnt, IID_Obstruction);
	let cmpNewObstruction = Engine.QueryInterface(newEnt, IID_Obstruction);
	if (cmpObstruction && cmpNewObstruction)
	{
		cmpNewObstruction.SetControlGroup(cmpObstruction.GetControlGroup());
		cmpNewObstruction.SetControlGroup2(cmpObstruction.GetControlGroup2());
	}
}

function ObstructionsBlockingTemplateChange(ent, templateArg)
{
	var previewEntity = Engine.AddEntity("preview|"+templateArg);

	if (previewEntity == INVALID_ENTITY)
		return true;

	CopyControlGroups(ent, previewEntity);
	var cmpBuildRestrictions = Engine.QueryInterface(previewEntity, IID_BuildRestrictions);
	var cmpPosition = Engine.QueryInterface(ent, IID_Position);
	var cmpOwnership = Engine.QueryInterface(ent, IID_Ownership);

	var cmpNewPosition = Engine.QueryInterface(previewEntity, IID_Position);

	// Return false if no ownership as BuildRestrictions.CheckPlacement needs an owner and I have no idea if false or true is better
	// Plus there are no real entities without owners currently.
	if (!cmpBuildRestrictions || !cmpPosition || !cmpOwnership)
		return DeleteEntityAndReturn(previewEntity, cmpPosition, null, null, cmpNewPosition, false);

	var pos = cmpPosition.GetPosition2D();
	var angle = cmpPosition.GetRotation();
	// move us away to prevent our own obstruction from blocking the upgrade.
	cmpPosition.MoveOutOfWorld();

	cmpNewPosition.JumpTo(pos.x, pos.y);
	cmpNewPosition.SetYRotation(angle.y);

	var cmpNewOwnership = Engine.QueryInterface(previewEntity, IID_Ownership);
	cmpNewOwnership.SetOwner(cmpOwnership.GetOwner());

	var checkPlacement = cmpBuildRestrictions.CheckPlacement();

	if (checkPlacement && !checkPlacement.success)
		return DeleteEntityAndReturn(previewEntity, cmpPosition, pos, angle, cmpNewPosition, true);

	var cmpTemplateManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_TemplateManager);
	var template = cmpTemplateManager.GetTemplate(cmpTemplateManager.GetCurrentTemplateName(ent));
	var newTemplate = cmpTemplateManager.GetTemplate(templateArg);

	// Check if units are blocking our template change
	if (template.Obstruction && newTemplate.Obstruction)
	{
		// This only needs to be done if the new template is strictly bigger than the old one
		// "Obstructions" are annoying to test so just check.
		if (newTemplate.Obstruction.Obstructions ||

			newTemplate.Obstruction.Static && template.Obstruction.Static &&
				(newTemplate.Obstruction.Static["@width"] > template.Obstruction.Static["@width"] ||
				 newTemplate.Obstruction.Static["@depth"] > template.Obstruction.Static["@depth"]) ||
			newTemplate.Obstruction.Static && template.Obstruction.Unit &&
				(newTemplate.Obstruction.Static["@width"] > template.Obstruction.Unit["@radius"] ||
				 newTemplate.Obstruction.Static["@depth"] > template.Obstruction.Unit["@radius"]) ||

			newTemplate.Obstruction.Unit && template.Obstruction.Unit &&
				newTemplate.Obstruction.Unit["@radius"] > template.Obstruction.Unit["@radius"] ||
			newTemplate.Obstruction.Unit && template.Obstruction.Static &&
				(newTemplate.Obstruction.Unit["@radius"] > template.Obstruction.Static["@width"] ||
				 newTemplate.Obstruction.Unit["@radius"] > template.Obstruction.Static["@depth"]))
		{
			var cmpNewObstruction = Engine.QueryInterface(previewEntity, IID_Obstruction);
			if (cmpNewObstruction && cmpNewObstruction.GetBlockMovementFlag())
			{
				// Remove all obstructions at the new entity, especially animal corpses
				for (let ent of cmpNewObstruction.GetEntitiesDeletedUponConstruction())
					Engine.DestroyEntity(ent);

				let collisions = cmpNewObstruction.GetEntitiesBlockingConstruction();
				if (collisions.length)
					return DeleteEntityAndReturn(previewEntity, cmpPosition, pos, angle, cmpNewPosition, true);
			}
		}
	}

	return DeleteEntityAndReturn(previewEntity, cmpPosition, pos, angle, cmpNewPosition, false);
}

function DeleteEntityAndReturn(ent, cmpPosition, position, angle, cmpNewPosition, ret)
{
	// prevent preview from interfering in the world
	cmpNewPosition.MoveOutOfWorld();
	if (position !== null)
	{
		cmpPosition.JumpTo(position.x, position.y);
		cmpPosition.SetYRotation(angle.y);
	}

	Engine.DestroyEntity(ent);
	return ret;
}

function TransferGarrisonedUnits(oldEnt, newEnt)
{
	// Transfer garrisoned units if possible, or unload them
	let cmpOldGarrison = Engine.QueryInterface(oldEnt, IID_GarrisonHolder);
	if (!cmpOldGarrison || !cmpOldGarrison.GetEntities().length)
		return;

	let cmpNewGarrison = Engine.QueryInterface(newEnt, IID_GarrisonHolder);
	let entities = cmpOldGarrison.GetEntities().slice();
	for (let ent of entities)
	{
		cmpOldGarrison.Unload(ent);
		if (!cmpNewGarrison)
			continue;
		let cmpGarrisonable = Engine.QueryInterface(ent, IID_Garrisonable);
		if (!cmpGarrisonable)
			continue;
		cmpGarrisonable.Garrison(newEnt);
	}
}

Engine.RegisterGlobal("ChangeEntityTemplate", ChangeEntityTemplate);
Engine.RegisterGlobal("ObstructionsBlockingTemplateChange", ObstructionsBlockingTemplateChange);
