import type {
  ActivityOption,
  FillBlanksActivityConfig,
  MatchingActivityConfig,
  MultipleChoiceActivityConfig,
  NumericActivityConfig,
  OrderingActivityConfig,
  ShortAnswerActivityConfig,
  SingleChoiceActivityConfig,
  TrueFalseActivityConfig,
  WritingActivityConfig,
} from '@synaploom/contracts';

export type PublicSingleChoiceConfig = Omit<SingleChoiceActivityConfig, 'correctOptionId'>;
export type PublicMultipleChoiceConfig = Omit<MultipleChoiceActivityConfig, 'correctOptionIds'>;
export type PublicTrueFalseConfig = Omit<TrueFalseActivityConfig, 'expected'>;
export type PublicShortAnswerConfig = Omit<
  ShortAnswerActivityConfig,
  'acceptedAnswers' | 'pattern'
>;
export type PublicFillBlanksConfig = {
  readonly blanks: readonly {
    readonly id: string;
    readonly label: string;
    readonly normalization?: FillBlanksActivityConfig['blanks'][number]['normalization'];
  }[];
  readonly scoring: FillBlanksActivityConfig['scoring'];
};
export type PublicOrderingConfig = Omit<OrderingActivityConfig, 'correctOrder'>;
export type PublicMatchingConfig = Omit<MatchingActivityConfig, 'correctMatches'>;
export type PublicNumericConfig = Omit<NumericActivityConfig, 'expected'>;
export type PublicWritingConfig = WritingActivityConfig;

export function optionById(
  options: readonly ActivityOption[],
  id: string,
): ActivityOption | undefined {
  return options.find((option) => option.id === id);
}
