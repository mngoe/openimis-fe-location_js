import { healthFacilityLabel, LOCATION_SUMMARY_PROJECTION } from "../utils";
import React, { useState, useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { useModulesManager, useTranslations, Autocomplete, useGraphqlQuery } from "@openimis/fe-core";
import _debounce from "lodash/debounce";
const HealthFacilityPicker = (props) => {
  const {
    onChange,
    readOnly,
    required,
    withLabel = true,
    withPlaceholder,
    value,
    label,
    filterOptions,
    filterSelectedOptions,
    placeholder,
    multiple,
    region,
    district,
    level,
    options,
    onDataChange,
    autoComplete
  } = props;

  const modulesManager = useModulesManager();
  const { formatMessage } = useTranslations("location", modulesManager);
  const [searchString, setSearchString] = useState("");
  const lastAutoFillKeyRef = useRef(null);
  let pickedDistrictsUuids = [];
  Array.isArray(district) ? pickedDistrictsUuids = district?.map((district) => district?.uuid) : pickedDistrictsUuids.push(district?.uuid);
  const districtSignature = pickedDistrictsUuids.filter(Boolean).sort().join(",");
  const { data, isLoading, error } = useGraphqlQuery(
    `
    query HealthFacilityPicker ($str: String, $region: String, $district: [String], $level: String) {
      healthFacilities: healthFacilitiesStr(first: 20, str: $str, regionUuid: $region, districtsUuids: $district, level: $level) {
        edges {
          node {
            id
            uuid
            code
            name
            level
            servicesPricelist{id, uuid}
            itemsPricelist{id, uuid}
            location {${LOCATION_SUMMARY_PROJECTION.join(",")} parent { ${LOCATION_SUMMARY_PROJECTION.join(",")} }}
          }
        }
      }
    }
  `,
    { level, region: region?.uuid, district: pickedDistrictsUuids, str: searchString },
    { skip: true },
  );

  const haveSameHealthFacilities = (left = [], right = []) => {
    if (left.length !== right.length) return false;
    const leftIds = left.map((hf) => hf?.uuid ?? hf?.id).filter(Boolean).sort();
    const rightIds = right.map((hf) => hf?.uuid ?? hf?.id).filter(Boolean).sort();
    return leftIds.every((id, idx) => id === rightIds[idx]);
  };

  useEffect(() => {
    if (!(multiple && autoComplete && !!district && data?.healthFacilities?.edges)) return;

    const fetchedFacilities = data.healthFacilities.edges.map((edge) => edge.node);
    const fetchedSignature = fetchedFacilities
      .map((hf) => hf?.uuid ?? hf?.id)
      .filter(Boolean)
      .sort()
      .join(",");
    const autoFillKey = `${districtSignature}|${fetchedSignature}`;

    if (lastAutoFillKeyRef.current === autoFillKey) return;
    lastAutoFillKeyRef.current = autoFillKey;

    const pickedDistrictUuids = new Set(
      (Array.isArray(district) ? district : [district])
        .filter(Boolean)
        .map((d) => d?.uuid),
    );

    const currentSelection = Array.isArray(value) ? value : [];
    const filteredCurrentSelection = currentSelection.filter((hf) =>
      pickedDistrictUuids.has(hf?.location?.uuid),
    );

    const mergedByUuid = new Map();
    [...filteredCurrentSelection, ...fetchedFacilities].forEach((hf) => {
      const key = hf?.uuid ?? hf?.id;
      if (key) mergedByUuid.set(key, hf);
    });

    const mergedFacilities = Array.from(mergedByUuid.values());

    if (!haveSameHealthFacilities(currentSelection, mergedFacilities)) {
      onDataChange?.(mergedFacilities);
    }
  }, [data, district, districtSignature, multiple, autoComplete, value, onDataChange]);

  return (
    <Autocomplete
      multiple={multiple}
      required={required}
      placeholder={placeholder ?? formatMessage("HealthFacilityPicker.placeholder")}
      label={label ?? formatMessage("HealthFacilityPicker.label")}
      error={error}
      withLabel={withLabel}
      withPlaceholder={withPlaceholder}
      readOnly={readOnly}
      options={options ?? data?.healthFacilities?.edges.map((edge) => edge.node) ?? []}
      isLoading={isLoading}
      value={value}
      getOptionLabel={healthFacilityLabel}
      onChange={(option) => onChange(option, healthFacilityLabel(option))}
      filterOptions={filterOptions}
      filterSelectedOptions={filterSelectedOptions}
      onInputChange={setSearchString}
    />
  );
};

export default HealthFacilityPicker;
