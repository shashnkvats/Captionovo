import unittest

from captionovo.providers.deepgram import normalize_deepgram_response


SAMPLE_RESPONSE = {
    "results": {
        "language": "en",
        "metadata": {"duration": 12.5},
        "channels": [
            {
                "alternatives": [
                    {
                        "transcript": "Hello world.",
                        "confidence": 0.98,
                        "utterances": [
                            {
                                "start": 0.0,
                                "end": 2.5,
                                "transcript": "Hello world.",
                                "confidence": 0.98,
                                "speaker": 0,
                            },
                            {
                                "start": 3.0,
                                "end": 5.0,
                                "transcript": "Namaste.",
                                "confidence": 0.91,
                                "speaker": 1,
                            },
                        ],
                    }
                ]
            }
        ],
    }
}


class DeepgramNormalizeTests(unittest.TestCase):
    def test_maps_utterances_to_internal_segments(self) -> None:
        result = normalize_deepgram_response(SAMPLE_RESPONSE)

        self.assertEqual(result.detected_language, "english")
        self.assertEqual(result.duration_ms, 12500)
        self.assertEqual(len(result.segments), 2)
        self.assertEqual(result.segments[0].text, "Hello world.")
        self.assertEqual(result.segments[0].speaker_key, "speaker_1")
        self.assertEqual(result.segments[1].speaker_key, "speaker_2")
        self.assertEqual(len(result.speakers), 2)
        self.assertAlmostEqual(
            sum(speaker.speaking_percent for speaker in result.speakers),
            100.0,
            places=0,
        )

    def test_falls_back_to_full_transcript(self) -> None:
        payload = {
            "results": {
                "metadata": {"duration": 3.0},
                "channels": [
                    {
                        "alternatives": [
                            {
                                "transcript": "Single block.",
                                "confidence": 0.9,
                            }
                        ]
                    }
                ],
            }
        }

        result = normalize_deepgram_response(payload)
        self.assertEqual(len(result.segments), 1)
        self.assertEqual(result.segments[0].text, "Single block.")


if __name__ == "__main__":
    unittest.main()
