// 0x4a8bf0 Shore_Begin size=141

int __thiscall sub_4A8BF0(int this, const void *a2)
{
  int result; // eax
  __int16 v4; // cx
  const void *v5; // esi
  bool v6; // zf
  int v7; // eax
  __int16 v8; // cx
  _WORD v9[4]; // [esp+8h] [ebp-8h] BYREF

  result = *(_DWORD *)(this + 4476);
  if ( result != 0 )
  {
    v4 = *(_WORD *)(this + 4470) + *(_WORD *)(this + 4474);
    v9[0] = *(_WORD *)(this + 4468) + *(_WORD *)(this + 4472);
    v9[1] = v4;
    result = sub_4A95A0(v9, 0);
  }
  v5 = a2;
  v6 = a2 == nullptr;
  *(_DWORD *)(this + 4472) = dword_8A03F8;
  if ( v6 )
  {
    *(_DWORD *)(this + 4476) = 0;
  }
  else
  {
    if ( (byte_8A0618 & 1) == 0 )
    {
      byte_8A0618 |= 1u;
      atexit(nullsub_10);
    }
    qmemcpy(&unk_8A041C, v5, 0x1E0u);
    *(_DWORD *)(this + 4476) = &unk_8A041C;
    v7 = *(_DWORD *)sub_4A94F0(&a2, &unk_8A041C);
    v9[0] = v7 - 1;
    v9[1] = HIWORD(v7) - 1;
    LOWORD(a2) = (__int16)(1 - v7) / 2;
    HIWORD(a2) = (__int16)(1 - HIWORD(v7)) / 2;
    v8 = (__int16)a2;
    *(_DWORD *)(this + 4472) = a2;
    LOWORD(v7) = *(_WORD *)(this + 4474) + *(_WORD *)(this + 4470);
    LOWORD(a2) = v8 + *(_WORD *)(this + 4468);
    HIWORD(a2) = v7;
    return sub_4A95A0(&a2, 1);
  }
  return result;
}
