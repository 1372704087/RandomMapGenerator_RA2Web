// 0x58d0a0 Region_IdAt size=29

int __thiscall sub_58D0A0(__int16 *this)
{
  if ( dword_ABED10 != nullptr )
    return *((_DWORD *)dword_ABED10 + 20 * *this + 20 * dword_89C2DC * *(this + 1) + 14);
  else
    return -1;
}
