
'use server';

import { z } from 'zod';

const AdjustFormulaInputSchema = z.object({
  historicalPerformanceData: z.string().min(10, { message: "Historical data is too short." }),
  targetWeightParameters: z.string().min(10, { message: "Target parameters are too short." }),
  materialNames: z.string().min(3, { message: "Material names are required." }),
});

type State = {
  recommendations?: string;
  error?: string | Record<string, string[]>;
}

export async function getFormulaRecommendations(
  prevState: State,
  formData: FormData
): Promise<State> {
  const validatedFields = AdjustFormulaInputSchema.safeParse({
    historicalPerformanceData: formData.get('historicalPerformanceData'),
    targetWeightParameters: formData.get('targetWeightParameters'),
    materialNames: formData.get('materialNames'),
  });

  if (!validatedFields.success) {
    return {
      error: validatedFields.error.flatten().fieldErrors,
    };
  }
  
  try {
    // const result = await adjustFormula(validatedFields.data);
    // return { recommendations: result.recommendations };
    return { error: 'AI features are temporarily disabled.' };
  } catch (error) {
    console.error('Error getting formula recommendations:', error);
    return { error: 'Failed to get recommendations. Please try again.' };
  }
}
