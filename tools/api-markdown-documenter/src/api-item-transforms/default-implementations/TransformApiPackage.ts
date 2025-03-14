/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */
import { ApiItem, ApiPackage } from "@microsoft/api-extractor-model";

import { SectionNode } from "../../documentation-domain";
import { ApiItemTransformationConfiguration } from "../configuration";
import { transformApiModuleLike } from "./TransformApiModuleLike";

/**
 * Default documentation transform for `Package` items.
 */
export function transformApiPackage(
	apiPackage: ApiPackage,
	config: Required<ApiItemTransformationConfiguration>,
	generateChildContent: (apiItem: ApiItem) => SectionNode[],
): SectionNode[] {
	const entryPoints = apiPackage.entryPoints;
	if (entryPoints.length !== 1) {
		throw new Error(
			"Encountered a package with multiple entry-points. API-Extractor only supports single-entry packages, so this should not be possible.",
		);
	}
	return transformApiModuleLike(apiPackage, entryPoints[0].members, config, generateChildContent);
}
