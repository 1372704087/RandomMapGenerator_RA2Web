char __thiscall sub_483780(int this, char a2)
{
  int v4; // eax
  int v5; // eax
  char v7; // bp
  int v8; // ebx
  int v9; // eax
  int v10; // [esp+10h] [ebp-Ch]
  int v11; // [esp+14h] [ebp-8h] BYREF
  int v12; // [esp+18h] [ebp-4h]
  int v13; // [esp+20h] [ebp+4h]

  if ( a2 == 0 )
  {
    if ( (char)**(_BYTE **)&byte_A8B260 >= 0 )
      return 0;
    v4 = sub_5FDD20(*(_DWORD *)(this + 68));
    if ( v4 == -1
      || *(unsigned __int8 *)(this + 286) <= v4 / 2
      || *(_BYTE *)(this + 284) != 0
      || *(double *)(*(_DWORD *)(HIDWORD(dbl_B0F518) + 4 * v4) + 160) < 2.09817511832308e-307
      || *(_DWORD *)(this + 228) != 0 )
    {
      return 0;
    }
  }
  v5 = sub_5FDD20(*(_DWORD *)(this + 68));
  v13 = v5;
  if ( a2 != 0 )
  {
    if ( v5 == -1 )
    {
      v13 = 0;
      v5 = 0;
    }
  }
  else if ( v5 == -1 )
  {
    return 0;
  }
  v12 = *(_DWORD *)(HIDWORD(dbl_B0F518) + 4 * v5);
  v7 = sub_65C7E0((_DWORD *)(*(_DWORD *)&byte_A8B260 + 536), 0, 7);
  v8 = 0;
  while ( 1 )
  {
    v9 = ((_BYTE)v8 + v7) & 7;
    v11 = *(_DWORD *)(this + 36);
    LOWORD(v10) = word_89F6B8[2 * v9] + v11;
    HIWORD(v10) = HIWORD(v11) + word_89F6BA[2 * v9];
    v11 = v10;
    if ( sub_5657A0(&stru_87F7E8, (__int16 *)&v11) != nullptr && (unsigned __int8)sub_4838E0(v12) != 0 )
      break;
    if ( ++v8 >= 8 )
      return 0;
  }
  return sub_487190(v13, 3);
}
