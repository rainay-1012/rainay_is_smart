import * as echarts from "echarts";
import _ from "lodash";
import {
  DataTransformOption,
  DimensionName,
  ExternalDataTransform,
  ExternalDataTransformParam,
} from "./transform-types";

interface CountByTransformOption extends DataTransformOption {
  type: "utils:count";
  config: {
    source: DimensionName;
  };
}

interface RenameKeyTransformOption extends DataTransformOption {
  type: "utils:renameKey";
  config: {
    map: Record<string, string>;
    exception?: string;
  };
}

interface ObjectSplitTransformOption extends DataTransformOption {
  type: "utils:objectSplit";
  config: {
    index?: number;
  };
}

interface PickTransformOption extends DataTransformOption {
  type: "utils:pick";
  config: {
    cols: string[];
  };
}

export type TransformType =
  | "utils:countBy"
  | "utils:renameKeys"
  | "utils:objectSplit"
  | "utils:flat"
  | "utils:pick";

export type RegisterTransformTypes = TransformType | "all";

export const countBy: ExternalDataTransform<CountByTransformOption> = {
  type: "utils:countBy",
  transform: (params: ExternalDataTransformParam<CountByTransformOption>) => {
    const { upstream, config } = params;
    const rawData = upstream.cloneRawData();
    const { source } = config || {};

    const grouped = _.countBy(rawData, source);
    console.log(grouped);

    return {
      data: [grouped],
    }; // input: data: ["a", "b", "b"] | output: data: [{"a":1,"b":2}]
  },
};

export const renameKeys: ExternalDataTransform<RenameKeyTransformOption> = {
  type: "utils:renameKeys",
  transform: (params: ExternalDataTransformParam<RenameKeyTransformOption>) => {
    const { upstream, config } = params;
    const rawData = upstream.cloneRawData();
    const { map, exception } = config || {};

    const resultData = rawData.map(function (o: Record<string, any>) {
      return _.mapKeys(o, function (v, k) {
        return map[k] || (exception ? exception : k);
      });
    });

    return {
      data: resultData,
    };
  },
};

export const objectSplit: ExternalDataTransform<ObjectSplitTransformOption> = {
  type: "utils:objectSplit",
  transform: (
    params: ExternalDataTransformParam<ObjectSplitTransformOption>
  ) => {
    const { upstream, config } = params;
    const rawData = upstream.cloneRawData();
    const { index } = config || {};

    return {
      data: _.map(_.toPairs(rawData[index ?? 0]), (pair) =>
        _.fromPairs([pair])
      ),
    }; // input: data: [{"a":1,"b":2}] | output: data: [{"a":1}, {"b":2}]
  },
};

export const flat: ExternalDataTransform<DataTransformOption> = {
  type: "utils:flat",
  transform: (params: ExternalDataTransformParam<DataTransformOption>) => {
    const { upstream } = params;
    const rawData = upstream.cloneRawData();

    return {
      data: _.flatMap(rawData, (obj: Record<string, any>) =>
        _.map(_.toPairs(obj), ([key, value]) => ({ name: key, value }))
      ),
    }; // input: data: [{"a":24},{"b":1}] | output: data: [{"name":"a","value":24},{"name":"b","value":1}]
  },
};

export const pick: ExternalDataTransform<DataTransformOption> = {
  type: "utils:pick",
  // @ts-ignore
  transform: (params: ExternalDataTransformParam<PickTransformOption>) => {
    const { upstream, config } = params;
    const rawData = upstream.cloneRawData();
    const { cols } = config || {};

    return {
      data: rawData.map((item) => _.pick(item, cols)),
    }; // input: data: [{"a":24},{"b":1}] | output: data: [{"name":"a","value":24},{"name":"b","value":1}]
  },
};

export type ExternalDataTransformWithCorrectType =
  ExternalDataTransform<DataTransformOption>;

export function registerTransforms(
  transformTypes: RegisterTransformTypes | RegisterTransformTypes[]
) {
  // Define the list of available transformations
  const allTransforms: Record<TransformType, ExternalDataTransform<any>> = {
    "utils:countBy": countBy,
    "utils:renameKeys": renameKeys,
    "utils:objectSplit": objectSplit,
    "utils:flat": flat,
    "utils:pick": pick,
  };

  if (
    transformTypes === "all" ||
    (Array.isArray(transformTypes) && transformTypes.includes("all"))
  ) {
    Object.values(allTransforms).forEach((transform) => {
      // @ts-ignore
      echarts.registerTransform(transform);
    });
  } else {
    const typesToRegister = Array.isArray(transformTypes)
      ? transformTypes
      : [transformTypes];
    typesToRegister.forEach((type) => {
      // @ts-ignore
      const transform = allTransforms[type];
      if (transform) {
        echarts.registerTransform(transform);
      } else {
        console.warn(`Transformation type "${type}" not found.`);
      }
    });
  }
}
